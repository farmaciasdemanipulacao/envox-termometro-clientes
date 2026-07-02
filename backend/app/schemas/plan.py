"""Schemas para planos de assinatura."""
from typing import Optional
from pydantic import BaseModel


class PlanResponse(BaseModel):
    id: str
    slug: str
    name: str
    description: Optional[str] = None
    price_monthly: float
    max_groups: int
    max_history_days: Optional[int] = None
    features: Optional[list] = None
    is_active: bool
    display_order: int
    is_featured: bool

    model_config = {"from_attributes": True}


class PlanCreate(BaseModel):
    slug: str
    name: str
    description: Optional[str] = None
    price_monthly: float
    max_groups: int = 5
    max_history_days: Optional[int] = 90
    features: Optional[list] = None
    is_active: bool = True
    display_order: int = 0
    is_featured: bool = False


class PlanUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price_monthly: Optional[float] = None
    max_groups: Optional[int] = None
    max_history_days: Optional[int] = None
    features: Optional[list] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None
    is_featured: Optional[bool] = None
