"""Models: CollaboratorMetric e ConversationMetric."""
import uuid
from typing import Optional
from datetime import date

from sqlalchemy import Integer, Float, Date, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin


class CollaboratorMetric(Base, UUIDMixin, TimestampMixin):
    """
    Métricas diárias de cada colaborador interno.
    Atualizado pelo MetricsUpdateJob.
    """
    __tablename__ = "collaborator_metrics"

    participant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("participants.id"), nullable=False, index=True
    )
    metric_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    messages_sent: Mapped[int] = mapped_column(Integer, default=0)
    conversations_handled: Mapped[int] = mapped_column(Integer, default=0)
    avg_response_minutes: Mapped[float] = mapped_column(Float, default=0.0)
    followups_pending: Mapped[int] = mapped_column(Integer, default=0)
    followups_completed: Mapped[int] = mapped_column(Integer, default=0)
    risk_conversations: Mapped[int] = mapped_column(Integer, default=0)
    opportunity_conversations: Mapped[int] = mapped_column(Integer, default=0)
    friction_incidents: Mapped[int] = mapped_column(Integer, default=0)
    quality_score: Mapped[float] = mapped_column(Float, default=50.0)
    # 0-100: calculado a partir de tempo de resposta, follow-up rate e atrito

    # Relationships
    participant: Mapped["Participant"] = relationship(
        "Participant", back_populates="collaborator_metrics"
    )


class ConversationMetric(Base, UUIDMixin, TimestampMixin):
    """
    Métricas diárias de cada conversa/grupo.
    Alimenta o termômetro por grupo do dashboard.
    """
    __tablename__ = "conversation_metrics"

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=False, index=True
    )
    metric_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    total_messages: Mapped[int] = mapped_column(Integer, default=0)
    avg_sentiment: Mapped[float] = mapped_column(Float, default=0.0)
    risk_score: Mapped[float] = mapped_column(Float, default=0.0)
    opportunity_score: Mapped[float] = mapped_column(Float, default=0.0)
    avg_response_minutes: Mapped[float] = mapped_column(Float, default=0.0)
    sla_breaches: Mapped[int] = mapped_column(Integer, default=0)
    followups_pending: Mapped[int] = mapped_column(Integer, default=0)
    friction_count: Mapped[int] = mapped_column(Integer, default=0)
    temperature_score: Mapped[int] = mapped_column(Integer, default=50)

    # Relationships
    conversation: Mapped["Conversation"] = relationship(
        "Conversation", back_populates="metrics"
    )
