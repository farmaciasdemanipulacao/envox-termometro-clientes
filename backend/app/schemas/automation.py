"""Schemas para as Automações do Sistema (jobs, settings, regras de alerta customizadas)."""
from typing import Optional
from pydantic import BaseModel


class JobConfigUpdate(BaseModel):
    enabled: Optional[bool] = None
    hour: Optional[int] = None
    minute: Optional[int] = None
    day_of_week: Optional[str] = None
    interval_minutes: Optional[int] = None


class SettingUpdate(BaseModel):
    value: float


class AlertRuleResponse(BaseModel):
    id: str
    nome: str
    keywords: list[str]
    severity: str
    ativo: bool

    model_config = {"from_attributes": True}


class AlertRuleCreate(BaseModel):
    nome: str
    keywords: list[str]
    severity: str = "medium"
    ativo: bool = True


class AlertRuleUpdate(BaseModel):
    nome: Optional[str] = None
    keywords: Optional[list[str]] = None
    severity: Optional[str] = None
    ativo: Optional[bool] = None
