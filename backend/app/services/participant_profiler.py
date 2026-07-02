"""
Perfilagem de participantes por IA.
Analisa o histórico de mensagens de cada participante e gera um perfil com:
- Estilo de comunicação
- Padrões de comportamento
- Nível de engajamento
- Pontos de atenção
- Estratégias de abordagem recomendadas
- Informações que faltam para conhecer melhor o cliente
"""
import json
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.core.config import settings
from app.core.logging import get_logger
from app.models.participant import Participant

logger = get_logger(__name__)

MIN_MESSAGES = 3          # mínimo para gerar perfil
MAX_MESSAGES_PER_PROFILE = 300  # limite de mensagens para não explodir tokens


_SYSTEM_PROMPT = """Você é um analista especialista em comportamento de clientes e comunicação B2B.
Seu objetivo é analisar mensagens de grupos WhatsApp de uma empresa de marketing digital (Envox)
e gerar um perfil detalhado sobre cada participante/cliente.

Seja específico, prático e direto. Use evidências concretas das mensagens.
Responda SOMENTE em JSON válido, sem markdown, sem blocos de código."""


MAX_CONTENT_PER_MSG = 300   # chars por mensagem (evita transcrições enormes)
MAX_PROMPT_CHARS    = 12000  # limite total do transcript

def _build_prompt(name: str, role: str, group_name: str, messages: list[dict]) -> str:
    lines = []
    total_chars = 0
    for m in messages[-MAX_MESSAGES_PER_PROFILE:]:
        date = m.get("sent_at", "")[:10] if m.get("sent_at") else "?"
        content = (m.get("content") or "").strip()
        if not content or content.startswith("["):
            continue
        content = content[:MAX_CONTENT_PER_MSG]
        line = f"[{date}] {content}"
        total_chars += len(line)
        if total_chars > MAX_PROMPT_CHARS:
            break
        lines.append(line)

    transcript = "\n".join(lines) if lines else "(nenhuma mensagem de texto)"

    return f"""Analise as mensagens abaixo do participante "{name}" (papel: {role}) no grupo "{group_name}".

MENSAGENS ({len(lines)} textuais de {len(messages)} no total):
{transcript}

Gere um perfil completo em JSON com exatamente estas chaves:
{{
  "communication_style": "Como essa pessoa escreve: tom, vocabulário, formalidade, uso de emojis, tamanho das mensagens...",
  "behavior_patterns": "O que ela costuma fazer/pedir/reclamar/questionar? Padrões recorrentes observados nas mensagens.",
  "engagement_level": "Alta/Média/Baixa — justifique com base na frequência, profundidade e qualidade das participações.",
  "attention_points": "Sinais de alerta: insatisfação, urgências recorrentes, riscos de cancelamento, conflitos, cobranças.",
  "approach_strategies": "Como a equipe DEVE abordar essa pessoa: tom ideal, cadência de contato, o que funciona, o que evitar.",
  "missing_info": "Quais informações sobre esse cliente ainda NÃO temos e seriam valiosas? Liste perguntas específicas que podem ser feitas naturalmente."
}}"""


async def _call_llm(prompt: str) -> str:
    """Chama o LLM disponível: tenta Anthropic, cai em Groq se necessário."""
    # Tenta Anthropic primeiro
    if settings.LLM_ENABLED and getattr(settings, "ANTHROPIC_API_KEY", None):
        try:
            import anthropic
            client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
            resp = await client.messages.create(
                model=settings.ANTHROPIC_MODEL,
                max_tokens=1500,
                system=_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": prompt}],
            )
            return resp.content[0].text.strip()
        except Exception as e:
            err = str(e).lower()
            if "credit" in err or "balance" in err or "billing" in err or "402" in err or "400" in err:
                logger.warning("anthropic_no_credits_falling_back_to_groq", error=str(e)[:100])
            else:
                raise

    # Fallback: Groq (llama-3.3-70b-versatile)
    groq_key = getattr(settings, "GROQ_API_KEY", None) or ""
    if not groq_key:
        raise RuntimeError("Nenhum LLM disponível (Anthropic sem créditos e GROQ_API_KEY não configurado)")

    import httpx
    body = {
        "model": "llama-3.3-70b-versatile",
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": 1500,
        "temperature": 0.3,
        "response_format": {"type": "json_object"},
    }
    async with httpx.AsyncClient(timeout=60) as http:
        r = await http.post(
            "https://api.groq.com/openai/v1/chat/completions",
            json=body,
            headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"].strip()


async def analyze_participant(
    participant: Participant,
    group_name: str,
    messages: list[dict],
    db: AsyncSession,
) -> dict:
    """
    Analisa o histórico de um participante com IA e salva o perfil em extra_data.
    Usa Anthropic se disponível, cai em Groq automaticamente.
    Retorna o dict de perfil gerado.
    """
    if len(messages) < MIN_MESSAGES:
        raise ValueError(f"Participante com apenas {len(messages)} mensagem(s) — mínimo {MIN_MESSAGES}")

    prompt = _build_prompt(
        name=participant.custom_name or participant.name,
        role=str(participant.role),
        group_name=group_name,
        messages=messages,
    )

    raw = await _call_llm(prompt)
    # Remove markdown code fences if Claude insisted
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    profile_data = json.loads(raw)

    profile_data["analyzed_at"] = datetime.now(timezone.utc).isoformat()
    profile_data["message_count"] = len(messages)

    extra = dict(participant.extra_data or {})
    extra["ai_profile"] = profile_data
    participant.extra_data = extra
    flag_modified(participant, "extra_data")
    await db.commit()

    logger.info(
        "participant_profile_generated",
        participant_id=str(participant.id),
        name=participant.name,
        messages=len(messages),
    )
    return profile_data


async def analyze_conversation_participants(
    conversation_id: str,
    db: AsyncSession,
    group_name: str = "",
    force: bool = False,
) -> dict:
    """
    Analisa todos os participantes de uma conversa com mensagens suficientes.
    Pula participantes já analisados (a menos que force=True).
    Retorna {"analyzed": N, "skipped": N, "errors": [...]}
    """
    import uuid

    conv_uuid = uuid.UUID(conversation_id)

    # Busca participantes com pelo menos MIN_MESSAGES mensagens nessa conversa
    rows = await db.execute(text("""
        SELECT p.id, p.name, p.custom_name, p.role, p.is_internal, p.extra_data,
               COUNT(m.id) as msg_count
        FROM participants p
        JOIN messages m ON m.participant_id = p.id
        WHERE m.conversation_id = :conv_id
        GROUP BY p.id, p.name, p.custom_name, p.role, p.is_internal, p.extra_data
        HAVING COUNT(m.id) >= :min_msgs
        ORDER BY msg_count DESC
    """), {"conv_id": str(conv_uuid), "min_msgs": MIN_MESSAGES})

    candidates = rows.fetchall()

    if not group_name:
        from app.models.conversation import Conversation
        conv_result = await db.execute(
            select(Conversation).where(Conversation.id == conv_uuid)
        )
        conv = conv_result.scalar_one_or_none()
        group_name = (conv.custom_name or conv.name) if conv else "Grupo"

    analyzed = skipped = 0
    errors = []

    for row in candidates:
        pid, name, cname, role, is_int, extra_data, msg_count = row
        display_name = cname or name

        # Pula internos (colaboradores) — foco nos clientes
        if is_int:
            skipped += 1
            continue

        # Pula se já foi analisado recentemente e não é forçado
        existing = (extra_data or {}).get("ai_profile")
        if existing and not force:
            skipped += 1
            continue

        # Busca mensagens do participante nessa conversa
        msg_rows = await db.execute(text("""
            SELECT content, sent_at, message_type
            FROM messages
            WHERE participant_id = :pid AND conversation_id = :conv_id
            ORDER BY sent_at ASC
        """), {"pid": str(pid), "conv_id": str(conv_uuid)})

        messages = [
            {"content": r[0], "sent_at": r[1].isoformat() if r[1] else None, "message_type": r[2]}
            for r in msg_rows.fetchall()
        ]

        # Busca o objeto Participant para poder salvar
        part_result = await db.execute(
            select(Participant).where(Participant.id == uuid.UUID(str(pid)))
        )
        part = part_result.scalar_one_or_none()
        if not part:
            continue

        try:
            await analyze_participant(part, group_name, messages, db)
            analyzed += 1
        except Exception as e:
            logger.error("participant_profile_error", participant=display_name, error=str(e))
            errors.append({"participant": display_name, "error": str(e)})

    return {"analyzed": analyzed, "skipped": skipped, "errors": errors}
