"""Log de cada envio individual de push — alimenta o relatório de interatividade por usuário."""
import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class PushDeliveryStatus(str, enum.Enum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"


class PushDelivery(Base):
    __tablename__ = "push_deliveries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    # Guarda o endpoint mesmo se a subscription for removida depois (unsubscribe/dispositivo trocado)
    subscription_id = Column(UUID(as_uuid=True), ForeignKey("push_subscriptions.id", ondelete="SET NULL"), nullable=True)
    endpoint = Column(Text, nullable=True)

    # NULL = alerta automático (heurística/scheduler); preenchido = campanha manual do admin
    campaign_id = Column(UUID(as_uuid=True), ForeignKey("push_campaigns.id", ondelete="CASCADE"), nullable=True, index=True)

    title = Column(String(200), nullable=False)
    body = Column(Text, nullable=False)
    tag = Column(String(100), nullable=True)

    status = Column(SAEnum(PushDeliveryStatus, name="push_delivery_status"), nullable=False, default=PushDeliveryStatus.PENDING, index=True)
    error = Column(Text, nullable=True)

    sent_at = Column(DateTime(timezone=True), nullable=True)
    clicked_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
