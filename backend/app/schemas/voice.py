"""Schemas Pydantic do módulo Voz do Cliente."""
from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class VoiceClientCreate(BaseModel):
    name: str
    slug: str
    legal_name: Optional[str] = None
    metadata_json: dict[str, Any] = Field(default_factory=dict)


class VoiceTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None


class VoiceVersionCreate(BaseModel):
    title: str
    intro_text: Optional[str] = None
    confidentiality_text: Optional[str] = None
    settings_json: dict[str, Any] = Field(default_factory=dict)


class VoiceQuestionCreate(BaseModel):
    key: str
    position: int
    section: Optional[str] = None
    question_type: str
    prompt: str
    help_text: Optional[str] = None
    is_required: bool = True
    options_json: list[Any] = Field(default_factory=list)
    condition_json: dict[str, Any] = Field(default_factory=dict)
    followup_json: dict[str, Any] = Field(default_factory=dict)
    dimension: Optional[str] = None
    weight: float = 1.0
    scoring_json: dict[str, Any] = Field(default_factory=dict)


class VoiceCampaignCreate(BaseModel):
    client_id: UUID
    version_id: UUID
    name: str
    status: str = "active"
    public_base_url: str = "https://pesquisa.envox.com.br"
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    settings_json: dict[str, Any] = Field(default_factory=dict)


class VoiceRespondentCreate(BaseModel):
    name: str
    whatsapp: Optional[str] = None
    role_function: Optional[str] = None
    sector: Optional[str] = None
    unit: Optional[str] = None
    regional: Optional[str] = None
    external_ref: Optional[str] = None
    metadata_json: dict[str, Any] = Field(default_factory=dict)


class VoiceRespondentBatchCreate(BaseModel):
    respondents: list[VoiceRespondentCreate]


class VoiceCsvImport(BaseModel):
    csv_text: str


class VoiceAnswerInput(BaseModel):
    question_key: str
    value: Any
    comment: Optional[str] = None


class VoiceAnswerBatch(BaseModel):
    answers: list[VoiceAnswerInput]


class VoiceBootstrapSecovi(BaseModel):
    campaign_name: str = "Diagnóstico de Percepção da Parceria Secovi-PR + Envox"
    public_base_url: str = "https://pesquisa.envox.com.br"
