"""Campanhas de push criadas manualmente pelo admin (em contraste com os alertas automáticos)."""
import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.db.base import Base


class PushCampaignTargetType(str, enum.Enum):
    ALL = "all"
    SPECIFIC = "specific"


class PushCampaignStatus(str, enum.Enum):
    QUEUED = "queued"
    SENDING = "sending"
    COMPLETED = "completed"
    FAILED = "failed"


class PushCampaign(Base):
    __tablename__ = "push_campaigns"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    title = Column(String(200), nullable=False)
    body = Column(Text, nullable=False)
    url = Column(String(500), nullable=True, default="/")
    tag = Column(String(100), nullable=True, default="atenx-campaign")

    target_type = Column(SAEnum(PushCampaignTargetType, name="push_campaign_target_type"), nullable=False)
    target_user_ids = Column(JSONB, nullable=True)  # lista de UUIDs (string) quando target_type == SPECIFIC

    status = Column(SAEnum(PushCampaignStatus, name="push_campaign_status"), nullable=False, default=PushCampaignStatus.QUEUED)

    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
