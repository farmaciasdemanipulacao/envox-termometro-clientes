"""Configuração do Agente Virtual por tenant."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.db.base import Base


EXPRESSION_TYPES = ["neutral", "positive", "alert", "critical", "thinking"]

DEFAULT_EXPRESSIONS = [
    {"type": "neutral",  "label": "Neutro",     "emoji": "🤖", "image_b64": None, "image_mime": None},
    {"type": "positive", "label": "Positivo",   "emoji": "✅", "image_b64": None, "image_mime": None},
    {"type": "alert",    "label": "Em Alerta",  "emoji": "⚠️", "image_b64": None, "image_mime": None},
    {"type": "critical", "label": "Crítico",    "emoji": "🚨", "image_b64": None, "image_mime": None},
    {"type": "thinking", "label": "Analisando", "emoji": "🧠", "image_b64": None, "image_mime": None},
]


class AgentConfig(Base):
    __tablename__ = "agent_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                       nullable=False, unique=True, index=True)

    # Identidade
    name = Column(String(100), nullable=False, default="Agente ENVOX")
    role_label = Column(String(200), nullable=True)       # e.g. "Analista de CRM"
    personality = Column(Text, nullable=True)             # descrição de personalidade
    tone = Column(String(50), nullable=False, default="profissional")  # formal/profissional/amigavel/casual
    signature = Column(String(500), nullable=True)        # texto ao final de mensagens automáticas

    # Avatar
    avatar_b64 = Column(Text, nullable=True)              # base64 da imagem
    avatar_mime = Column(String(50), nullable=True)       # image/png | image/jpeg

    # Expressões: lista de {type, label, emoji, image_b64, image_mime}
    expressions = Column(JSONB, nullable=False, default=list)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))
