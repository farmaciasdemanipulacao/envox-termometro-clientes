"""Model: TenantConfig — configuração de WhatsApp por tenant."""
import uuid

from sqlalchemy import String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin


class TenantConfig(Base, UUIDMixin, TimestampMixin):
    """Configuração de sessão WhatsApp por tenant (usuário/empresa)."""
    __tablename__ = "tenant_configs"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False
    )
    wpp_session: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    wpp_secret: Mapped[str] = mapped_column(String(500), nullable=False)
    wpp_url: Mapped[str] = mapped_column(String(500), nullable=False)

    tenant: Mapped["User"] = relationship("User", back_populates="tenant_config")
