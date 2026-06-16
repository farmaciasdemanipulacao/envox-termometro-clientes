"""Schemas de resumos diários."""
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel


class DailySummaryOut(BaseModel):
    """Schema de saída do resumo diário."""
    id: str
    summary_date: date
    summary_type: str
    executive_text: str
    highlights: list = []
    critical_points: list = []
    opportunities: list = []
    pending_followups: list = []
    recurring_themes: list = []
    total_messages: int = 0
    total_participants: int = 0
    avg_sentiment_score: float = 0.0
    risk_score_avg: float = 0.0
    open_alerts_count: int = 0
    critical_alerts_count: int = 0
    followups_pending: int = 0
    opportunities_count: int = 0
    avg_response_minutes: float = 0.0
    temperature_score: int = 50
    temperature_label: str = "attention"
    generated_at: datetime
    generation_method: str = "heuristic"

    model_config = {"from_attributes": True}
