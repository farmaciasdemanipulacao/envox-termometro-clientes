"""Models: configuração editável das automações do sistema (Automações do Sistema)."""
import uuid
from typing import Optional

from sqlalchemy import String, Boolean, Integer, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class ScheduledJobConfig(Base, UUIDMixin, TimestampMixin):
    """
    Override editável de agendamento/ativação para um job do APScheduler.
    Uma linha por job_id (seed automático no startup com os defaults do código).
    Sem create/delete pela API — os jobs são fixos no código, só editáveis.
    """
    __tablename__ = "scheduled_job_configs"

    job_id: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    hour: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    minute: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    day_of_week: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    interval_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)


class SystemSetting(Base, UUIDMixin, TimestampMixin):
    """
    Configuração global editável (thresholds de alerta, retenção LGPD, etc.)
    key/value — seed automático no startup com os defaults de settings.py.
    Sem create/delete pela API — chaves fixas, só editáveis.
    """
    __tablename__ = "system_settings"

    key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    value: Mapped[dict] = mapped_column(JSONB, nullable=False)
    label: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class CustomAlertRule(Base, UUIDMixin, TimestampMixin):
    """Regra de alerta customizada criada pelo admin — CRUD completo."""
    __tablename__ = "custom_alert_rules"

    nome: Mapped[str] = mapped_column(String(200), nullable=False)
    keywords: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    severity: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
