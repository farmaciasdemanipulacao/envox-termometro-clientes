"""Model: Plan — planos de assinatura SaaS."""
from typing import Optional

from sqlalchemy import String, Boolean, Integer, Float, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin


class Plan(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "plans"

    slug: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    price_monthly: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    max_groups: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    # None = ilimitado (todo histórico); 0 = sem histórico; N = N dias
    max_history_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, default=90)
    features: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    subscriptions: Mapped[list["Subscription"]] = relationship(
        "Subscription", back_populates="plan", lazy="noload"
    )
