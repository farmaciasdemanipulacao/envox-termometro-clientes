"""Schemas do dashboard executivo."""
from typing import Optional
from pydantic import BaseModel


class AlertSummary(BaseModel):
    open: int = 0
    critical: int = 0
    high: int = 0
    medium: int = 0
    low: int = 0


class DashboardOverview(BaseModel):
    """Visão geral do dashboard — dados principais da tela inicial."""
    # Mensagens
    total_messages_today: int = 0
    total_messages_yesterday: int = 0

    # Conversas
    active_conversations: int = 0

    # Saúde operacional
    temperature_score: int = 50
    temperature_label: str = "attention"

    # Alertas
    alerts: AlertSummary = AlertSummary()

    # Oportunidades e Riscos
    opportunities_detected: int = 0
    churn_signals: int = 0
    followups_pending: int = 0

    # Performance
    avg_response_time_minutes: float = 0.0
    sla_breaches_today: int = 0

    # Tendências (hoje vs ontem)
    message_volume_trend: float = 0.0   # % de variação
    sentiment_trend: float = 0.0        # variação do score


class GroupMetric(BaseModel):
    """Métricas de um grupo/conversa para o dashboard."""
    conversation_id: str
    conversation_name: str
    original_name: str = ""
    custom_name: Optional[str] = None
    total_messages: int = 0
    avg_sentiment: float = 0.0
    sentiment_label: str = "neutral"
    risk_score: float = 0.0
    opportunity_score: float = 0.0
    avg_response_minutes: float = 0.0
    followups_pending: int = 0
    friction_count: int = 0
    temperature_score: int = 50
    sla_breaches: int = 0
    open_alerts: int = 0


class CollaboratorMetricOut(BaseModel):
    """Métricas de um colaborador para o dashboard."""
    participant_id: str
    participant_name: str
    messages_sent: int = 0
    conversations_handled: int = 0
    avg_response_minutes: float = 0.0
    followups_pending: int = 0
    followups_completed: int = 0
    risk_conversations: int = 0
    opportunity_conversations: int = 0
    friction_incidents: int = 0
    quality_score: float = 50.0
