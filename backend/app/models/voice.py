"""Models do módulo Voz do Cliente (pesquisas de percepção)."""
import secrets
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class VoiceClient(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "voice_clients"
    owner_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), nullable=False)
    legal_name: Mapped[Optional[str]] = mapped_column(String(500))
    metadata_json: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    __table_args__ = (UniqueConstraint("owner_user_id", "slug", name="uq_voice_client_owner_slug"),)


class VoiceSurveyTemplate(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "voice_survey_templates"
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("voice_clients.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class VoiceSurveyVersion(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "voice_survey_versions"
    template_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("voice_survey_templates.id", ondelete="CASCADE"), nullable=False, index=True)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    intro_text: Mapped[Optional[str]] = mapped_column(Text)
    confidentiality_text: Mapped[str] = mapped_column(
        Text,
        default="Pesquisa confidencial de percepção e qualidade da parceria. As respostas serão analisadas de forma consolidada e a identificação individual terá acesso restrito.",
        nullable=False,
    )
    settings_json: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    __table_args__ = (UniqueConstraint("template_id", "version_number", name="uq_voice_version_template_number"),)


class VoiceSurveyQuestion(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "voice_survey_questions"
    version_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("voice_survey_versions.id", ondelete="CASCADE"), nullable=False, index=True)
    key: Mapped[str] = mapped_column(String(100), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    section: Mapped[Optional[str]] = mapped_column(String(200))
    question_type: Mapped[str] = mapped_column(String(30), nullable=False)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    help_text: Mapped[Optional[str]] = mapped_column(Text)
    is_required: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    options_json: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    condition_json: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    followup_json: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    dimension: Mapped[Optional[str]] = mapped_column(String(50), index=True)
    weight: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    scoring_json: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    __table_args__ = (
        UniqueConstraint("version_id", "key", name="uq_voice_question_version_key"),
        UniqueConstraint("version_id", "position", name="uq_voice_question_version_position"),
    )


class VoiceSurveyCampaign(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "voice_survey_campaigns"
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("voice_clients.id", ondelete="CASCADE"), nullable=False, index=True)
    version_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("voice_survey_versions.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False, index=True)
    public_base_url: Mapped[str] = mapped_column(String(500), default="https://pesquisa.envox.com.br", nullable=False)
    starts_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    settings_json: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)


class VoiceSurveyRespondent(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "voice_survey_respondents"
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("voice_survey_campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    whatsapp: Mapped[Optional[str]] = mapped_column(String(50))
    role_function: Mapped[Optional[str]] = mapped_column(String(300))
    sector: Mapped[Optional[str]] = mapped_column(String(300), index=True)
    unit: Mapped[Optional[str]] = mapped_column(String(300), index=True)
    regional: Mapped[Optional[str]] = mapped_column(String(300), index=True)
    external_ref: Mapped[Optional[str]] = mapped_column(String(200))
    access_token: Mapped[str] = mapped_column(String(96), unique=True, nullable=False, index=True, default=lambda: secrets.token_urlsafe(32))
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False, index=True)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    first_opened_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    last_opened_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    perception_score: Mapped[Optional[float]] = mapped_column(Float)
    risk_score: Mapped[Optional[float]] = mapped_column(Float)
    health_classification: Mapped[Optional[str]] = mapped_column(String(20), index=True)
    dimension_scores_json: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    scoring_flags_json: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    metadata_json: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)


class VoiceSurveyAnswer(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "voice_survey_answers"
    respondent_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("voice_survey_respondents.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("voice_survey_questions.id", ondelete="CASCADE"), nullable=False, index=True)
    value_json: Mapped[object] = mapped_column(JSONB, nullable=False)
    comment: Mapped[Optional[str]] = mapped_column(Text)

    __table_args__ = (UniqueConstraint("respondent_id", "question_id", name="uq_voice_answer_respondent_question"),)


Index("idx_voice_respondent_campaign_status", VoiceSurveyRespondent.campaign_id, VoiceSurveyRespondent.status)
Index("idx_voice_campaign_client_status", VoiceSurveyCampaign.client_id, VoiceSurveyCampaign.status)

VOICE_TABLES = [
    VoiceClient.__table__,
    VoiceSurveyTemplate.__table__,
    VoiceSurveyVersion.__table__,
    VoiceSurveyQuestion.__table__,
    VoiceSurveyCampaign.__table__,
    VoiceSurveyRespondent.__table__,
    VoiceSurveyAnswer.__table__,
]
