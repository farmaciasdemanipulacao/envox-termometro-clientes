"""Model: Message — entidade central do sistema."""
import uuid
import enum
from typing import Optional
from datetime import datetime

from sqlalchemy import String, Boolean, Integer, Float, ForeignKey, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin


class MessageType(str, enum.Enum):
    TEXT = "text"
    IMAGE = "image"
    AUDIO = "audio"
    VIDEO = "video"
    DOCUMENT = "document"
    STICKER = "sticker"
    LOCATION = "location"
    SYSTEM = "system"   # Evento do sistema (ex: "alguém entrou no grupo")


class SentimentLabel(str, enum.Enum):
    POSITIVE = "positive"
    NEUTRAL = "neutral"
    NEGATIVE = "negative"
    CRITICAL = "critical"  # Muito negativo — alerta imediato
    UNKNOWN = "unknown"


class UrgencyLevel(str, enum.Enum):
    NONE = "none"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Message(Base, UUIDMixin, TimestampMixin):
    """
    Cada mensagem individual ingerida no sistema.
    Campos de análise são preenchidos pelo HeuristicsEngine após ingestão.
    """
    __tablename__ = "messages"

    # Identificação
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=False, index=True
    )
    participant_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("participants.id"), nullable=True
    )
    source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ingestion_sources.id"), nullable=False
    )
    external_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Conteúdo
    content: Mapped[str] = mapped_column(Text, nullable=False)
    masked_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    message_type: Mapped[MessageType] = mapped_column(
        String(20), default=MessageType.TEXT, nullable=False
    )

    # Timestamps
    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    ingested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    processed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # === ANÁLISE DE SENTIMENTO ===
    sentiment: Mapped[SentimentLabel] = mapped_column(
        String(20), default=SentimentLabel.UNKNOWN, nullable=False
    )
    sentiment_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    # -1.0 (muito negativo) a +1.0 (muito positivo)

    # === SCORES ===
    risk_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # 0-100: quanto maior, maior o risco
    opportunity_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # 0-100: quanto maior, mais provável oportunidade comercial
    urgency_level: Mapped[UrgencyLevel] = mapped_column(
        String(20), default=UrgencyLevel.NONE, nullable=False
    )

    # === FLAGS DETECTADAS ===
    is_followup_needed: Mapped[bool] = mapped_column(Boolean, default=False)
    is_promise_detected: Mapped[bool] = mapped_column(Boolean, default=False)
    is_complaint: Mapped[bool] = mapped_column(Boolean, default=False)
    is_escalation: Mapped[bool] = mapped_column(Boolean, default=False)
    is_opportunity: Mapped[bool] = mapped_column(Boolean, default=False)
    is_internal_friction: Mapped[bool] = mapped_column(Boolean, default=False)
    is_churn_risk: Mapped[bool] = mapped_column(Boolean, default=False)

    # === METADATA ===
    tags: Mapped[Optional[list]] = mapped_column(JSONB, default=list)
    raw_payload: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Relationships
    conversation: Mapped["Conversation"] = relationship("Conversation", back_populates="messages")
    participant: Mapped[Optional["Participant"]] = relationship("Participant", back_populates="messages")
    source: Mapped["IngestionSource"] = relationship("IngestionSource", back_populates="messages")
    alerts: Mapped[list["AlertEvent"]] = relationship(
        "AlertEvent", back_populates="message", lazy="noload"
    )
