"""Model: DailySummary — resumo diário gerado pelo job."""
import uuid
import enum
from typing import Optional
from datetime import date, datetime

from sqlalchemy import String, Integer, Float, ForeignKey, Text, Date, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin


class SummaryType(str, enum.Enum):
    GLOBAL = "global"              # Resumo de toda a operação
    PER_CONVERSATION = "per_conversation"  # Resumo por grupo/conversa


class TemperatureLabel(str, enum.Enum):
    EXCELLENT = "excellent"   # 81-100: operação saudável
    GOOD = "good"             # 61-80: boa
    ATTENTION = "attention"   # 41-60: atenção necessária
    WARNING = "warning"       # 21-40: preocupante
    CRITICAL = "critical"     # 0-20: crise


class GenerationMethod(str, enum.Enum):
    HEURISTIC = "heuristic"  # Apenas heurísticas
    LLM = "llm"              # Apenas LLM
    HYBRID = "hybrid"        # Heurísticas + LLM


class DailySummary(Base, UUIDMixin, TimestampMixin):
    """
    Resumo diário de toda a operação (ou por grupo).
    Gerado pelo DailySummaryJob ou sob demanda via API.
    """
    __tablename__ = "daily_summaries"

    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True
    )
    summary_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    conversation_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=True
    )
    summary_type: Mapped[SummaryType] = mapped_column(
        String(30), default=SummaryType.GLOBAL, nullable=False
    )

    # === CONTEÚDO TEXTUAL ===
    executive_text: Mapped[str] = mapped_column(Text, nullable=False)
    highlights: Mapped[Optional[list]] = mapped_column(JSONB, default=list)
    critical_points: Mapped[Optional[list]] = mapped_column(JSONB, default=list)
    opportunities: Mapped[Optional[list]] = mapped_column(JSONB, default=list)
    pending_followups: Mapped[Optional[list]] = mapped_column(JSONB, default=list)
    recurring_themes: Mapped[Optional[list]] = mapped_column(JSONB, default=list)

    # === MÉTRICAS DO DIA ===
    total_messages: Mapped[int] = mapped_column(Integer, default=0)
    total_participants: Mapped[int] = mapped_column(Integer, default=0)
    avg_sentiment_score: Mapped[float] = mapped_column(Float, default=0.0)
    risk_score_avg: Mapped[float] = mapped_column(Float, default=0.0)
    open_alerts_count: Mapped[int] = mapped_column(Integer, default=0)
    critical_alerts_count: Mapped[int] = mapped_column(Integer, default=0)
    followups_pending: Mapped[int] = mapped_column(Integer, default=0)
    opportunities_count: Mapped[int] = mapped_column(Integer, default=0)
    avg_response_minutes: Mapped[float] = mapped_column(Float, default=0.0)
    sla_breaches: Mapped[int] = mapped_column(Integer, default=0)

    # === TERMÔMETRO ===
    temperature_score: Mapped[int] = mapped_column(Integer, default=50)
    temperature_label: Mapped[TemperatureLabel] = mapped_column(
        String(20), default=TemperatureLabel.ATTENTION, nullable=False
    )

    # === META ===
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    generation_method: Mapped[GenerationMethod] = mapped_column(
        String(20), default=GenerationMethod.HEURISTIC, nullable=False
    )
    extra_data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Relationships
    conversation: Mapped[Optional["Conversation"]] = relationship(
        "Conversation", back_populates="summaries"
    )
