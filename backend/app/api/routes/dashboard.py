"""
Endpoints do dashboard executivo.
Todos os dados são filtrados pelo tenant do usuário autenticado.
"""
from datetime import datetime, date, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.message import Message
from app.models.conversation import Conversation
from app.models.alert import AlertEvent, AlertStatus, AlertSeverity
from app.models.followup import FollowUpItem, FollowUpStatus
from app.schemas.dashboard import DashboardOverview, AlertSummary, GroupMetric, CollaboratorMetricOut
from app.models.metrics import ConversationMetric, CollaboratorMetric
from app.models.participant import Participant
from app.models.message import MessageType

router = APIRouter()


@router.get(
    "/dashboard/overview",
    response_model=DashboardOverview,
    summary="Visão geral executiva",
)
async def get_dashboard_overview(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    today_start = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc)
    yesterday_start = today_start - timedelta(days=1)
    tid = current_user.id

    # Mensagens hoje (deste tenant)
    msgs_today = await db.execute(
        select(func.count(Message.id))
        .join(Conversation, Message.conversation_id == Conversation.id)
        .where(Message.sent_at >= today_start, Conversation.tenant_id == tid)
    )
    total_today = msgs_today.scalar() or 0

    # Mensagens ontem
    msgs_yesterday = await db.execute(
        select(func.count(Message.id))
        .join(Conversation, Message.conversation_id == Conversation.id)
        .where(
            Message.sent_at >= yesterday_start,
            Message.sent_at < today_start,
            Conversation.tenant_id == tid,
        )
    )
    total_yesterday = msgs_yesterday.scalar() or 0

    # Conversas ativas hoje
    convs = await db.execute(
        select(func.count(func.distinct(Message.conversation_id)))
        .join(Conversation, Message.conversation_id == Conversation.id)
        .where(Message.sent_at >= today_start, Conversation.tenant_id == tid)
    )
    active_conversations = convs.scalar() or 0

    # Alertas abertos (deste tenant — via conversation)
    alerts_data = await db.execute(
        select(AlertEvent.severity, func.count(AlertEvent.id))
        .join(Conversation, AlertEvent.conversation_id == Conversation.id)
        .where(AlertEvent.status == AlertStatus.OPEN, Conversation.tenant_id == tid)
        .group_by(AlertEvent.severity)
    )
    alerts_by_severity = {row[0]: row[1] for row in alerts_data.fetchall()}

    # Follow-ups pendentes
    followups_r = await db.execute(
        select(func.count(FollowUpItem.id))
        .join(Conversation, FollowUpItem.conversation_id == Conversation.id)
        .where(FollowUpItem.status == FollowUpStatus.PENDING, Conversation.tenant_id == tid)
    )
    followups_pending = followups_r.scalar() or 0

    # Oportunidades hoje
    opps_r = await db.execute(
        select(func.count(Message.id))
        .join(Conversation, Message.conversation_id == Conversation.id)
        .where(
            Message.sent_at >= today_start,
            Message.is_opportunity == True,  # noqa
            Conversation.tenant_id == tid,
        )
    )
    opportunities = opps_r.scalar() or 0

    # Churn signals hoje
    churn_r = await db.execute(
        select(func.count(Message.id))
        .join(Conversation, Message.conversation_id == Conversation.id)
        .where(
            Message.sent_at >= today_start,
            Message.is_churn_risk == True,  # noqa
            Conversation.tenant_id == tid,
        )
    )
    churn_signals = churn_r.scalar() or 0

    trend = 0.0
    if total_yesterday > 0:
        trend = ((total_today - total_yesterday) / total_yesterday) * 100

    temperature_score = 70
    temperature_label = "good"
    open_alerts_total = sum(alerts_by_severity.values())
    critical = alerts_by_severity.get(AlertSeverity.CRITICAL, 0)
    if critical >= 3 or open_alerts_total >= 10:
        temperature_score = 30
        temperature_label = "warning"
    elif critical >= 1 or open_alerts_total >= 5:
        temperature_score = 50
        temperature_label = "attention"

    return DashboardOverview(
        total_messages_today=total_today,
        total_messages_yesterday=total_yesterday,
        active_conversations=active_conversations,
        temperature_score=temperature_score,
        temperature_label=temperature_label,
        alerts=AlertSummary(
            open=open_alerts_total,
            critical=alerts_by_severity.get(AlertSeverity.CRITICAL, 0),
            high=alerts_by_severity.get(AlertSeverity.HIGH, 0),
            medium=alerts_by_severity.get(AlertSeverity.MEDIUM, 0),
            low=alerts_by_severity.get(AlertSeverity.LOW, 0),
        ),
        opportunities_detected=opportunities,
        churn_signals=churn_signals,
        followups_pending=followups_pending,
        avg_response_time_minutes=0.0,
        sla_breaches_today=0,
        message_volume_trend=round(trend, 1),
    )


@router.get(
    "/dashboard/groups",
    response_model=list[GroupMetric],
    summary="Métricas por grupo/conversa",
)
async def get_group_metrics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today_start = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc)
    tid = current_user.id

    result = await db.execute(
        select(
            Conversation.id,
            Conversation.name,
            Conversation.custom_name,
            func.count(Message.id).label("total_messages"),
            func.avg(Message.sentiment_score).label("avg_sentiment"),
            func.avg(Message.risk_score).label("risk_score"),
            func.avg(Message.opportunity_score).label("opportunity_score"),
        )
        .join(Message, Message.conversation_id == Conversation.id)
        .where(Message.sent_at >= today_start, Conversation.tenant_id == tid)
        .group_by(Conversation.id, Conversation.name, Conversation.custom_name)
        .order_by(func.avg(Message.risk_score).desc())
    )

    groups = []
    for row in result.fetchall():
        avg_sent = float(row.avg_sentiment or 0.0)
        risk = float(row.risk_score or 0.0)
        opp = float(row.opportunity_score or 0.0)

        if avg_sent > 0.3:
            sent_label = "positive"
        elif avg_sent < -0.3:
            sent_label = "negative"
        else:
            sent_label = "neutral"

        temp = max(0, min(100, int(100 - risk)))

        alerts_r = await db.execute(
            select(func.count(AlertEvent.id)).where(
                and_(
                    AlertEvent.conversation_id == row.id,
                    AlertEvent.status == AlertStatus.OPEN,
                )
            )
        )
        open_alerts = alerts_r.scalar() or 0

        fu_r = await db.execute(
            select(func.count(FollowUpItem.id)).where(
                and_(
                    FollowUpItem.conversation_id == row.id,
                    FollowUpItem.status == FollowUpStatus.PENDING,
                )
            )
        )
        followups = fu_r.scalar() or 0

        groups.append(GroupMetric(
            conversation_id=str(row.id),
            conversation_name=row.custom_name or row.name,
            original_name=row.name,
            custom_name=row.custom_name,
            total_messages=row.total_messages,
            avg_sentiment=round(avg_sent, 3),
            sentiment_label=sent_label,
            risk_score=round(risk, 1),
            opportunity_score=round(opp, 1),
            avg_response_minutes=0.0,
            followups_pending=followups,
            friction_count=0,
            temperature_score=temp,
            sla_breaches=0,
            open_alerts=open_alerts,
        ))

    return groups


@router.get(
    "/dashboard/recent-messages",
    summary="Mensagens recentes",
)
async def get_recent_messages(
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tid = current_user.id
    result = await db.execute(
        select(
            Message.id,
            Message.content,
            Message.message_type,
            Message.sent_at,
            Message.risk_score,
            Message.is_churn_risk,
            Message.is_opportunity,
            func.coalesce(Conversation.custom_name, Conversation.name).label("group_name"),
            func.coalesce(Participant.custom_name, Participant.name).label("sender"),
        )
        .join(Conversation, Message.conversation_id == Conversation.id)
        .join(Participant, Message.participant_id == Participant.id)
        .where(Conversation.tenant_id == tid)
        .order_by(Message.sent_at.desc())
        .limit(min(limit, 50))
    )
    rows = result.fetchall()

    type_icons = {
        "text": "💬", "audio": "🎤", "image": "🖼️",
        "document": "📄", "video": "📹", "sticker": "😊",
        "location": "📍", "contact": "👤",
    }

    messages = []
    for r in rows:
        messages.append({
            "id": str(r.id),
            "content": (r.content or "")[:120],
            "message_type": r.message_type,
            "type_icon": type_icons.get(r.message_type, "💬"),
            "sent_at": r.sent_at.isoformat() if r.sent_at else None,
            "risk_score": round(float(r.risk_score or 0), 0),
            "is_churn_risk": bool(r.is_churn_risk),
            "is_opportunity": bool(r.is_opportunity),
            "group_name": r.group_name or "",
            "sender": r.sender or "",
        })
    return messages
