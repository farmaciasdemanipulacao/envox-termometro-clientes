"""Model: Conversation — grupo ou thread de conversa."""
import uuid
import enum
from typing import Optional

from sqlalchemy import String, Boolean, Integer, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin


class ConversationType(str, enum.Enum):
    GROUP = "group"          # Grupo WhatsApp / multiparticipante
    INDIVIDUAL = "individual"  # Chat 1:1
    TICKET = "ticket"        # Ticket de atendimento (Zendesk, etc.)
    CHANNEL = "channel"      # Canal broadcast


class Conversation(Base, UUIDMixin, TimestampMixin):
    """
    Agrupa mensagens de um mesmo contexto (grupo WA, ticket, chat 1:1).
    É a unidade principal de análise e reporting.
    """
    __tablename__ = "conversations"

    source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ingestion_sources.id"), nullable=False
    )
    external_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    conversation_type: Mapped[ConversationType] = mapped_column(
        String(50), default=ConversationType.GROUP, nullable=False
    )
    custom_name: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    participant_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sla_response_minutes: Mapped[int] = mapped_column(Integer, default=60, nullable=False)
    extra_data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Relationships
    source: Mapped["IngestionSource"] = relationship("IngestionSource", back_populates="conversations")
    messages: Mapped[list["Message"]] = relationship(
        "Message", back_populates="conversation", lazy="noload"
    )
    alerts: Mapped[list["AlertEvent"]] = relationship(
        "AlertEvent", back_populates="conversation", lazy="noload"
    )
    summaries: Mapped[list["DailySummary"]] = relationship(
        "DailySummary", back_populates="conversation", lazy="noload"
    )
    followups: Mapped[list["FollowUpItem"]] = relationship(
        "FollowUpItem", back_populates="conversation", lazy="noload"
    )
    metrics: Mapped[list["ConversationMetric"]] = relationship(
        "ConversationMetric", back_populates="conversation", lazy="noload"
    )
