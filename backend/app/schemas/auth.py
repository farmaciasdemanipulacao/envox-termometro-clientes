"""Schemas de autenticação e usuários."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # segundos
    user_id: str
    username: str
    full_name: Optional[str] = None
    is_admin: bool


class UserCreate(BaseModel):
    username: str
    password: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    is_admin: bool = False


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    is_admin: Optional[bool] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None


class UserMeUpdate(BaseModel):
    """Atualização do próprio perfil — sem is_admin nem is_active."""
    full_name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None


class UserResponse(BaseModel):
    id: str
    username: str
    full_name: Optional[str]
    email: Optional[str]
    is_active: bool
    is_admin: bool
    last_login_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class UserStatsResponse(BaseModel):
    id: str
    username: str
    full_name: Optional[str]
    email: Optional[str]
    is_active: bool
    is_admin: bool
    last_login_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    conversations_count: int = 0
    messages_count: int = 0

    model_config = {"from_attributes": True}
