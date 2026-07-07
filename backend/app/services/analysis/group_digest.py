"""
Resumo diário "tipo ata" por grupo — usado no envio automático de WhatsApp (job das 06h).

Diferente do resumo executivo agregado (summarizer.py, uso interno/dashboard), aqui
cada grupo recebe um texto só sobre as PRÓPRIAS conversas do dia, reaproveitando a
mesma geração de texto do "Resumo Geral" manual (api/routes/intelligence.py, D-007).
"""
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.message import Message
from app.models.participant import Participant
from app.models.conversation import Conversation


def _conv_display(conv: Conversation) -> str:
    return conv.custom_name or conv.name or str(conv.id)[:8]


async def generate_group_daily_ata(
    db: AsyncSession,
    conversation: Conversation,
    target_date: date,
    agent_config: dict | None = None,
) -> tuple[str, str]:
    """
    Gera o texto "ata de reunião" das conversas de UM grupo em um dia específico,
    já com a identidade/assinatura/expressão do agente injetada.
    Retorna (texto, temperature_label) — o label escolhe a imagem de expressão a enviar.
    """
    from app.api.routes.intelligence import _generate_general_text
    from app.services.agent import inject_agent_identity

    conv_name = _conv_display(conversation)
    date_str = target_date.isoformat()

    start_dt = datetime.combine(target_date, datetime.min.time()).replace(tzinfo=timezone.utc)
    end_dt = start_dt + timedelta(days=1) - timedelta(seconds=1)

    msg_result = await db.execute(
        select(Message).where(
            and_(
                Message.conversation_id == conversation.id,
                Message.sent_at >= start_dt,
                Message.sent_at <= end_dt,
            )
        ).order_by(Message.sent_at)
    )
    messages = msg_result.scalars().all()
    total_messages = len(messages)

    if total_messages == 0:
        text = f"📋 *Resumo — {conv_name}*\nNenhuma mensagem registrada no período."
        text = inject_agent_identity(text, agent_config, "saudavel")
        return text, "saudavel"

    participant_ids = list({m.participant_id for m in messages if m.participant_id})
    participant_names: dict = {}
    if participant_ids:
        part_result = await db.execute(select(Participant).where(Participant.id.in_(participant_ids)))
        for p in part_result.scalars().all():
            participant_names[p.id] = p.custom_name or p.name or str(p.id)[:8]

    def _msg_to_line(m) -> str:
        ts = m.sent_at.strftime("%d/%m %H:%M") if m.sent_at else "??"
        author = participant_names.get(m.participant_id, "Desconhecido")
        content = (m.content or "").strip()[:300]
        return f"[{ts}] {author}: {content}"

    unique_participants = len(participant_ids)
    avg_risk = sum(m.risk_score or 0 for m in messages) / total_messages
    avg_sentiment = sum(m.sentiment_score or 0.0 for m in messages) / total_messages

    churn_count = sum(1 for m in messages if m.is_churn_risk)
    escalation_count = sum(1 for m in messages if m.is_escalation)
    opportunity_count = sum(1 for m in messages if m.is_opportunity)
    complaint_count = sum(1 for m in messages if m.is_complaint)
    followup_count = sum(1 for m in messages if m.is_followup_needed)

    tag_dist: dict = {}
    for m in messages:
        for tag in (m.tags or []):
            tag_dist[tag] = tag_dist.get(tag, 0) + 1

    # Mesmo cálculo de temperatura usado no range-summary manual (intelligence.py)
    risk_norm = min(avg_risk / 100, 1.0)
    churn_norm = min(churn_count / max(total_messages, 1) * 10, 1.0)
    sentiment_neg = max(-avg_sentiment, 0)
    temperature_score = int((risk_norm * 0.5 + churn_norm * 0.3 + sentiment_neg * 0.2) * 100)
    temperature_score = max(0, min(100, temperature_score))

    if temperature_score >= 70:
        temperature_label = "critico"
    elif temperature_score >= 40:
        temperature_label = "alerta"
    elif temperature_score >= 20:
        temperature_label = "moderado"
    else:
        temperature_label = "saudavel"

    top = sorted(messages, key=lambda m: (m.risk_score or 0), reverse=True)[:5]

    if total_messages <= 80:
        sample = messages
    else:
        first25 = messages[:25]
        last25 = messages[-25:]
        by_risk = sorted(messages, key=lambda m: (m.risk_score or 0), reverse=True)[:25]
        seen_ids = set()
        sample = []
        for m in first25 + by_risk + last25:
            if m.id not in seen_ids:
                seen_ids.add(m.id)
                sample.append(m)
        sample.sort(key=lambda m: m.sent_at or datetime.min.replace(tzinfo=timezone.utc))

    transcript_lines = [_msg_to_line(m) for m in sample]

    text = await _generate_general_text(
        conv_name=conv_name,
        start_date=date_str,
        end_date=date_str,
        total_messages=total_messages,
        unique_participants=unique_participants,
        churn_count=churn_count,
        escalation_count=escalation_count,
        opportunity_count=opportunity_count,
        complaint_count=complaint_count,
        followup_count=followup_count,
        tag_dist=tag_dist,
        top_messages=top,
        transcript_lines=transcript_lines,
        db=db,
        agent_config=agent_config,
    )
    text = inject_agent_identity(text, agent_config, temperature_label)

    return text, temperature_label
