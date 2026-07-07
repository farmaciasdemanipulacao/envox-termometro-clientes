"""Model: AlertEvent — alertas gerados pelo sistema."""
import uuid
import enum
from typing import Optional
from datetime import datetime

from sqlalchemy import String, ForeignKey, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin


class AlertType(str, enum.Enum):
    RISK = "risk"                     # Risco geral
    CHURN_RISK = "churn_risk"         # Risco de cancelamento
    OPPORTUNITY = "opportunity"       # Oportunidade comercial
    FOLLOWUP_DELAY = "followup_delay" # Follow-up em atraso
    SLA_BREACH = "sla_breach"         # SLA violado
    FRICTION = "friction"             # Atrito interno
    COMPLAINT = "complaint"           # Reclamação
    ESCALATION = "escalation"         # Escalada de tensão
    PROMISE_UNMET = "promise_unmet"   # Promessa sem retorno
    CUSTOM = "custom"                 # Regra de alerta customizada (CustomAlertRule)


class AlertSeverity(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AlertStatus(str, enum.Enum):
    OPEN = "open"
    ACKNOWLEDGED = "acknowledged"  # Visto, mas não resolvido
    RESOLVED = "resolved"
    DISMISSED = "dismissed"        # Descartado (falso positivo)


class AlertEvent(Base, UUIDMixin, TimestampMixin):
    """
    Alerta gerado automaticamente pelo sistema.
    Pode ser gerado inline na ingestão ou pelo AlertScanJob.
    """
    __tablename__ = "alert_events"

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=False, index=True
    )
    message_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("messages.id"), nullable=True
    )
    participant_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("participants.id"), nullable=True
    )

    alert_type: Mapped[AlertType] = mapped_column(String(30), nullable=False)
    severity: Mapped[AlertSeverity] = mapped_column(
        String(20), default=AlertSeverity.MEDIUM, nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    excerpt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    status: Mapped[AlertStatus] = mapped_column(
        String(20), default=AlertStatus.OPEN, nullable=False, index=True
    )
    triggered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    resolved_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    resolution_comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    extra_data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Relationships
    conversation: Mapped["Conversation"] = relationship("Conversation", back_populates="alerts")
    message: Mapped[Optional["Message"]] = relationship("Message", back_populates="alerts")
