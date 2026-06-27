"""Model: IngestionSource — origem dos dados."""
import uuid
import enum
from typing import Optional

from sqlalchemy import String, Boolean, DateTime, Enum as SAEnum, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin


class SourceType(str, enum.Enum):
    WEBHOOK = "webhook"
    CSV = "csv"
    JSON_IMPORT = "json_import"
    WHATSAPP_API = "whatsapp_api"
    OMNICHANNEL = "omnichannel"
    MANUAL = "manual"
    SIMULATOR = "simulator"  # Para seeds/testes


class IngestionSource(Base, UUIDMixin, TimestampMixin):
    """
    Representa a origem dos dados.
    Cada conector/fonte que alimenta o sistema tem um registro aqui.
    Essencial para rastreabilidade e LGPD.
    """
    __tablename__ = "ingestion_sources"

    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source_type: Mapped[SourceType] = mapped_column(
        SAEnum(SourceType, name="source_type_enum"), nullable=False
    )
    config: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    api_key_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)  # SHA-256
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_ingestion_at: Mapped[Optional[DateTime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    conversations: Mapped[list["Conversation"]] = relationship(
        "Conversation", back_populates="source", lazy="noload"
    )
    messages: Mapped[list["Message"]] = relationship(
        "Message", back_populates="source", lazy="noload"
    )
