"""Model: ProcessingRun — rastreabilidade de execuções."""
import enum
from typing import Optional
from datetime import datetime

from sqlalchemy import String, Integer, Text, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class RunType(str, enum.Enum):
    INGESTION = "ingestion"
    ANALYSIS = "analysis"
    SUMMARY = "summary"
    ALERT_SCAN = "alert_scan"
    METRICS_UPDATE = "metrics_update"
    CLEANUP = "cleanup"


class RunStatus(str, enum.Enum):
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    PARTIAL = "partial"


class ProcessingRun(Base, UUIDMixin, TimestampMixin):
    """
    Registra cada execução de processamento do sistema.
    Essencial para auditoria, LGPD e debugging.
    """
    __tablename__ = "processing_runs"

    run_type: Mapped[RunType] = mapped_column(String(30), nullable=False, index=True)
    status: Mapped[RunStatus] = mapped_column(
        String(20), default=RunStatus.RUNNING, nullable=False
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    items_processed: Mapped[int] = mapped_column(Integer, default=0)
    items_failed: Mapped[int] = mapped_column(Integer, default=0)
    error_log: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    extra_data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
