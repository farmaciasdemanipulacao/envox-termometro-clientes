"""Model: CustomAnalysisRun — histórico de Análises Personalizadas geradas (D-049)."""
import uuid
from typing import Optional
from datetime import date as date_

from sqlalchemy import String, Text, Date, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class CustomAnalysisRun(Base, UUIDMixin, TimestampMixin):
    """
    Registro persistido de cada Análise Personalizada gerada (D-036), para consulta
    posterior no painel — quando foi feita, com que pergunta, sobre quais grupos/período
    e qual foi a resposta da IA.
    """
    __tablename__ = "custom_analysis_runs"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    question: Mapped[str] = mapped_column(Text, nullable=False)
    start_date: Mapped[date_] = mapped_column(Date, nullable=False)
    end_date: Mapped[date_] = mapped_column(Date, nullable=False)
    conversation_ids: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    groups_snapshot: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    answer_text: Mapped[str] = mapped_column(Text, nullable=False)
    total_messages: Mapped[Optional[int]] = mapped_column(Integer, default=0)
