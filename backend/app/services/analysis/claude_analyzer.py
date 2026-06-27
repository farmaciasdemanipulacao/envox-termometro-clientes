"""
Análise de conversas com Claude Sonnet.

Fluxo:
  1. alert_scan_job chama enrich_open_alerts() a cada 15 min
  2. Para cada alerta aberto ainda não enriquecido, busca as últimas mensagens da conversa
  3. Claude analisa o contexto completo e retorna: risco, churn, oportunidade, ação recomendada
  4. Resultado é salvo em AlertEvent.extra_data e atualiza a descrição do alerta

A análise por mensagem individual permanece heurística (rápida, sem custo de API).
Claude é reservado para análise contextual de conversas completas.
"""
import asyncio
import os
from datetime import datetime, timezone, timedelta
from typing import Optional

from sqlalchemy import select, and_, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger

logger = get_logger(__name__)

_MESSAGE_PROMPT = """Analise esta mensagem de WhatsApp de um grupo de clientes de farmácia de manipulação e responda em JSON:

{{
  "sentimento": "positivo" | "neutro" | "negativo",
  "score_sentimento": <float -1.0 a 1.0>,
  "risco": <int 0-100>,
  "oportunidade": <int 0-100>,
  "churn": <bool>,
  "reclamacao": <bool>,
  "follow_up": <bool>,
  "promessa": <bool>,
  "escalacao": <bool>,
  "urgencia": "none" | "low" | "medium" | "high" | "critical",
  "tags": [<lista de tags relevantes, máx 5>]
}}

Mensagem: "{content}"

Responda APENAS com o JSON."""

_ANALYSIS_PROMPT = """Você é um analista de relacionamento com clientes de uma empresa de manipulação farmacêutica.
Analise as mensagens abaixo de um grupo do WhatsApp e responda em JSON com exatamente esta estrutura:

{{
  "risco": "baixo" | "medio" | "alto" | "critico",
  "churn_risk": true | false,
  "oportunidade": true | false,
  "sentiment": "positivo" | "neutro" | "negativo",
  "resumo": "<2-3 frases descrevendo o que está acontecendo nesta conversa>",
  "acao_recomendada": "<ação específica que o time deve tomar, ou null se não há urgência>",
  "pontos_chave": ["<ponto 1>", "<ponto 2>"]
}}

Grupo: {conversation_name}
Período: {period}

Mensagens (mais antigas primeiro):
{messages}

Responda APENAS com o JSON, sem texto adicional."""


def _llm_available() -> bool:
    from app.core.config import settings
    return settings.LLM_ENABLED and bool(os.getenv("ANTHROPIC_API_KEY", "").strip())


async def analyze_single_message(message_id: str, content: str) -> None:
    """
    Analisa uma mensagem individual com Claude e atualiza seus campos no DB.
    Chamado como background task após ingestão (fire-and-forget).
    """
    if not _llm_available():
        return
    if not content or content.startswith("[") or len(content) < 5:
        return

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, _sync_analyze_message, content)
    if not result:
        return

    from app.db.session import AsyncSessionLocal
    from app.models.message import Message, SentimentLabel, UrgencyLevel
    import uuid

    async with AsyncSessionLocal() as db:
        try:
            row = await db.execute(select(Message).where(Message.id == uuid.UUID(message_id)))
            msg = row.scalar_one_or_none()
            if not msg:
                return

            sentiment_map = {"positivo": SentimentLabel.POSITIVE, "neutro": SentimentLabel.NEUTRAL, "negativo": SentimentLabel.NEGATIVE}
            urgency_map = {"none": UrgencyLevel.NONE, "low": UrgencyLevel.LOW, "medium": UrgencyLevel.MEDIUM, "high": UrgencyLevel.HIGH, "critical": UrgencyLevel.CRITICAL}

            msg.sentiment = sentiment_map.get(result.get("sentimento", "neutro"), SentimentLabel.NEUTRAL)
            msg.sentiment_score = float(result.get("score_sentimento", 0.0))
            msg.risk_score = int(result.get("risco", msg.risk_score))
            msg.opportunity_score = int(result.get("oportunidade", msg.opportunity_score))
            msg.is_churn_risk = bool(result.get("churn", msg.is_churn_risk))
            msg.is_complaint = bool(result.get("reclamacao", msg.is_complaint))
            msg.is_followup_needed = bool(result.get("follow_up", msg.is_followup_needed))
            msg.is_promise_detected = bool(result.get("promessa", msg.is_promise_detected))
            msg.is_escalation = bool(result.get("escalacao", msg.is_escalation))
            msg.urgency_level = urgency_map.get(result.get("urgencia", "none"), UrgencyLevel.NONE)
            msg.tags = result.get("tags", msg.tags or [])

            await db.commit()
            logger.info("claude_message_analyzed", message_id=message_id, risco=msg.risk_score, churn=msg.is_churn_risk)
        except Exception as e:
            await db.rollback()
            logger.error("claude_message_update_failed", error=str(e), message_id=message_id)


def _sync_analyze_message(content: str) -> Optional[dict]:
    import json
    import anthropic
    from app.core.config import settings

    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    client = anthropic.Anthropic(api_key=api_key)

    prompt = _MESSAGE_PROMPT.format(content=content[:1000].replace('"', "'"))

    try:
        resp = client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = (resp.content[0].text or "").strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw)
    except Exception as e:
        logger.error("claude_message_analysis_failed", error=str(e))
        return None


async def analyze_conversation(
    db: AsyncSession,
    conversation_id,
    lookback_minutes: int = 60,
) -> Optional[dict]:
    """
    Analisa uma conversa com Claude. Retorna dict com análise ou None.
    """
    if not _llm_available():
        return None

    from app.models.message import Message
    from app.models.conversation import Conversation

    cutoff = datetime.now(timezone.utc) - timedelta(minutes=lookback_minutes)

    conv_result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = conv_result.scalar_one_or_none()
    if not conversation:
        return None

    msgs_result = await db.execute(
        select(Message)
        .where(and_(
            Message.conversation_id == conversation_id,
            Message.sent_at >= cutoff,
        ))
        .order_by(Message.sent_at.asc())
        .limit(40)
    )
    messages = msgs_result.scalars().all()

    if not messages:
        return None

    period = f"últimos {lookback_minutes} minutos"
    messages_text = "\n".join(
        f"[{msg.sent_at.strftime('%H:%M')}] {msg.content[:300]}"
        for msg in messages
        if msg.content and not msg.content.startswith("[")
    )

    if not messages_text.strip():
        return None

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None,
        _sync_analyze,
        conversation.name,
        period,
        messages_text,
    )


def _sync_analyze(conversation_name: str, period: str, messages_text: str) -> Optional[dict]:
    import json
    import anthropic
    from app.core.config import settings

    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    client = anthropic.Anthropic(api_key=api_key)

    prompt = _ANALYSIS_PROMPT.format(
        conversation_name=conversation_name,
        period=period,
        messages=messages_text,
    )

    try:
        resp = client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = (resp.content[0].text or "").strip()

        # Remove blocos de código se o modelo os incluiu
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]

        result = json.loads(raw)
        logger.info(
            "claude_analysis_ok",
            conversation=conversation_name,
            risco=result.get("risco"),
            churn=result.get("churn_risk"),
            model=settings.ANTHROPIC_MODEL,
        )
        return result
    except Exception as e:
        logger.error("claude_analysis_failed", error=str(e), conversation=conversation_name)
        return None


async def enrich_open_alerts(db: AsyncSession) -> int:
    """
    Enriquece alertas recentes não analisados pelo Claude.
    Chamado pelo alert_scan_job. Retorna quantidade de alertas enriquecidos.
    """
    if not _llm_available():
        return 0

    from app.models.alert import AlertEvent, AlertStatus

    # Alertas abertos das últimas 2h ainda sem análise Claude
    cutoff = datetime.now(timezone.utc) - timedelta(hours=2)
    result = await db.execute(
        select(AlertEvent).where(
            and_(
                AlertEvent.status == AlertStatus.OPEN,
                AlertEvent.triggered_at >= cutoff,
                # extra_data sem chave 'claude_analyzed' = ainda não analisado
            )
        ).limit(10)
    )
    alerts = result.scalars().all()

    # Filtra os que ainda não foram enriquecidos
    pending = [a for a in alerts if not (a.extra_data or {}).get("claude_analyzed")]

    enriched = 0
    seen_conversations = set()

    for alert in pending:
        conv_id = alert.conversation_id
        if conv_id in seen_conversations:
            # Já analisamos esta conversa neste ciclo — reutiliza se disponível
            continue
        seen_conversations.add(conv_id)

        analysis = await analyze_conversation(db, conv_id, lookback_minutes=90)
        if not analysis:
            continue

        # Enriquece a descrição do alerta com o resumo do Claude
        resumo = analysis.get("resumo", "")
        acao = analysis.get("acao_recomendada")
        pontos = analysis.get("pontos_chave", [])

        enriched_description = alert.description
        if resumo:
            enriched_description += f"\n\n**Análise IA:** {resumo}"
        if acao:
            enriched_description += f"\n\n**Ação recomendada:** {acao}"
        if pontos:
            enriched_description += "\n\n**Pontos-chave:**\n" + "\n".join(f"• {p}" for p in pontos)

        alert.description = enriched_description
        alert.extra_data = {
            **(alert.extra_data or {}),
            "claude_analyzed": True,
            "claude_analysis": analysis,
            "claude_analyzed_at": datetime.now(timezone.utc).isoformat(),
        }
        enriched += 1

    if enriched > 0:
        await db.commit()
        logger.info("claude_alerts_enriched", count=enriched)

    return enriched


async def generate_conversation_briefing(
    db: AsyncSession,
    conversation_id,
    lookback_hours: int = 24,
) -> Optional[str]:
    """
    Gera um briefing textual completo de uma conversa para o EOD.
    Usado pelo BriefingService.
    """
    if not _llm_available():
        return None

    analysis = await analyze_conversation(db, conversation_id, lookback_minutes=lookback_hours * 60)
    if not analysis:
        return None

    resumo = analysis.get("resumo", "")
    acao = analysis.get("acao_recomendada")
    risco = analysis.get("risco", "baixo")
    churn = analysis.get("churn_risk", False)
    opp = analysis.get("oportunidade", False)

    parts = [resumo]
    if churn:
        parts.append("⚠️ Risco de churn identificado.")
    if opp:
        parts.append("✅ Oportunidade comercial detectada.")
    if acao:
        parts.append(f"**Ação:** {acao}")

    return " ".join(parts)
