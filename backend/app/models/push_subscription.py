"""Modelo para armazenar subscriptions de Web Push por usuário."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Campos da Web Push Subscription
    endpoint = Column(Text, nullable=False, unique=True)
    p256dh = Column(Text, nullable=False)   # chave pública do cliente
    auth = Column(Text, nullable=False)     # segredo de autenticação

    # Metadados
    user_agent = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
