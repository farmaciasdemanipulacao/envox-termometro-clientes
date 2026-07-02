"""Schemas para assinaturas SaaS."""
from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class SubscriptionResponse(BaseModel):
    id: str
    user_id: str
    plan_id: str
    plan_name: Optional[str] = None
    plan_slug: Optional[str] = None
    status: str
    trial_ends_at: Optional[datetime] = None
    current_period_start: Optional[datetime] = None
    current_period_end: Optional[datetime] = None
    payment_ref: Optional[str] = None
    cancelled_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class SubscriptionUpdate(BaseModel):
    plan_id: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    current_period_end: Optional[datetime] = None
    payment_ref: Optional[str] = None
