"""Model: EmailAccount — conta de e-mail monitorada pelo sistema."""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Boolean, Integer, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class EmailAccount(Base, UUIDMixin, TimestampMixin):
    """Credenciais IMAP de uma conta de e-mail a ser monitorada."""
    __tablename__ = "email_accounts"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    host: Mapped[str] = mapped_column(String(500), nullable=False)
    port: Mapped[int] = mapped_column(Integer, default=993, nullable=False)
    username: Mapped[str] = mapped_column(String(500), nullable=False)
    password_enc: Mapped[str] = mapped_column(Text, nullable=False)
    use_ssl: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_sync_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
