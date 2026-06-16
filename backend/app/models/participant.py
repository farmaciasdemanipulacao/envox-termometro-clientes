"""Model: Participant — qualquer pessoa nas conversas."""
import uuid
import enum
from typing import Optional

from sqlalchemy import String, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin


class ParticipantRole(str, enum.Enum):
    CUSTOMER = "customer"        # Cliente externo
    COLLABORATOR = "collaborator"  # Colaborador ENVOX
    MANAGER = "manager"          # Gestor ENVOX
    BOT = "bot"                  # Chatbot / automação
    UNKNOWN = "unknown"          # Não identificado


class Participant(Base, UUIDMixin, TimestampMixin):
    """
    Qualquer pessoa que participa das conversas.
    Clientes e colaboradores são distinguidos pelo campo `role` e `is_internal`.
    """
    __tablename__ = "participants"

    external_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    # Phone mascarado por padrão (LGPD)
    phone_masked: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    role: Mapped[ParticipantRole] = mapped_column(
        String(30), default=ParticipantRole.UNKNOWN, nullable=False
    )
    is_internal: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    extra_data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Relationships
    messages: Mapped[list["Message"]] = relationship(
        "Message", back_populates="participant", lazy="noload"
    )
    collaborator_metrics: Mapped[list["CollaboratorMetric"]] = relationship(
        "CollaboratorMetric", back_populates="participant", lazy="noload"
    )
    followups: Mapped[list["FollowUpItem"]] = relationship(
        "FollowUpItem", foreign_keys="FollowUpItem.assigned_to_id",
        back_populates="assigned_to", lazy="noload"
    )
