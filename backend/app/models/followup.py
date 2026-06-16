"""Model: FollowUpItem — pendências e follow-ups detectados."""
import uuid
import enum
from typing import Optional
from datetime import datetime

from sqlalchemy import String, ForeignKey, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base, TimestampMixin, UUIDMixin


class FollowUpStatus(str, enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"


class FollowUpItem(Base, UUIDMixin, TimestampMixin):
    """
    Follow-up pendente detectado automaticamente ou criado manualmente.
    Rastreia compromissos e ações necessárias.
    """
    __tablename__ = "follow_up_items"

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=False
    )
    message_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("messages.id"), nullable=True
    )
    assigned_to_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("participants.id"), nullable=True
    )

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    due_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[FollowUpStatus] = mapped_column(
        String(20), default=FollowUpStatus.PENDING, nullable=False, index=True
    )
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    conversation: Mapped["Conversation"] = relationship("Conversation", back_populates="followups")
    assigned_to: Mapped[Optional["Participant"]] = relationship(
        "Participant", foreign_keys=[assigned_to_id], back_populates="followups"
    )
