"""
Endpoints do dashboard executivo.
Entregam os dados consolidados para a visão geral.
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

router = APIRouter()


@router.get(
    "/dashboard/overview",
    response_model=DashboardOverview,
    summary="Visão geral executiva",
    description="Retorna os principais KPIs do dia para o dashboard executivo.",
)
async def get_dashboard_overview(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    today_start = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc)
    yesterday_start = today_start - timedelta(days=1)

    # Mensagens hoje
    msgs_today = await db.execute(
        select(func.count(Message.id)).where(Message.sent_at >= today_start)
    )
    total_today = msgs_today.scalar() or 0

    # Mensagens ontem
    msgs_yesterday = await db.execute(
        select(func.count(Message.id)).where(
            and_(Message.sent_at >= yesterday_start, Message.sent_at < today_start)
        )
    )
    total_yesterday = msgs_yesterday.scalar() or 0

    # Conversas ativas
    convs = await db.execute(
        select(func.count(func.distinct(Message.conversation_id))).where(
            Message.sent_at >= today_start
        )
    )
    active_conversations = convs.scalar() or 0

    # Alertas por severidade (abertos)
    alerts_data = await db.execute(
        select(AlertEvent.severity, func.count(AlertEvent.id)).where(
            AlertEvent.status == AlertStatus.OPEN
        ).group_by(AlertEvent.severity)
    )
    alerts_by_severity = {row[0]: row[1] for row in alerts_data.fetchall()}

    # Follow-ups pendentes
    followups_r = await db.execute(
        select(func.count(FollowUpItem.id)).where(
            FollowUpItem.status == FollowUpStatus.PENDING
        )
    )
    followups_pending = followups_r.scalar() or 0

    # Oportunidades hoje
    opps_r = await db.execute(
        select(func.count(Message.id)).where(
            and_(Message.sent_at >= today_start, Message.is_opportunity == True)  # noqa
        )
    )
    opportunities = opps_r.scalar() or 0

    # Churn signals hoje
    churn_r = await db.execute(
        select(func.count(Message.id)).where(
            and_(Message.sent_at >= today_start, Message.is_churn_risk == True)  # noqa
        )
    )
    churn_signals = churn_r.scalar() or 0

    # Tendência de volume (%)
    trend = 0.0
    if total_yesterday > 0:
        trend = ((total_today - total_yesterday) / total_yesterday) * 100

    # Termômetro — usa último resumo global se disponível
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
        avg_response_time_minutes=0.0,  # TODO: calcular
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

    # Agrega métricas por conversa para hoje
    result = await db.execute(
        select(
            Conversation.id,
            Conversation.name,
            func.count(Message.id).label("total_messages"),
            func.avg(Message.sentiment_score).label("avg_sentiment"),
            func.avg(Message.risk_score).label("risk_score"),
            func.avg(Message.opportunity_score).label("opportunity_score"),
        )
        .join(Message, Message.conversation_id == Conversation.id)
        .where(Message.sent_at >= today_start)
        .group_by(Conversation.id, Conversation.name)
        .order_by(func.avg(Message.risk_score).desc())
    )

    groups = []
    for row in result.fetchall():
        avg_sent = float(row.avg_sentiment or 0.0)
        risk = float(row.risk_score or 0.0)
        opp = float(row.opportunity_score or 0.0)

        # Calcular sentimento label
        if avg_sent > 0.3:
            sent_label = "positive"
        elif avg_sent < -0.3:
            sent_label = "negative"
        else:
            sent_label = "neutral"

        # Termômetro simples do grupo
        temp = max(0, min(100, int(100 - risk)))

        # Alertas abertos para o grupo
        alerts_r = await db.execute(
            select(func.count(AlertEvent.id)).where(
                and_(
                    AlertEvent.conversation_id == row.id,
                    AlertEvent.status == AlertStatus.OPEN,
                )
            )
        )
        open_alerts = alerts_r.scalar() or 0

        # Follow-ups pendentes do grupo
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
            conversation_name=row.name,
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
