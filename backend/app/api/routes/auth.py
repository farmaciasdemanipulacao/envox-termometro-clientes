"""Endpoints de autenticação."""
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, Token
from app.core.security import verify_password, create_access_token
from app.core.config import settings

router = APIRouter()


@router.post("/auth/token", response_model=Token)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Autentica usuário e retorna JWT.
    Usar: POST /api/v1/auth/token com body {"username": "admin", "password": "..."}
    """
    result = await db.execute(
        select(User).where(User.username == request.username, User.is_active == True)  # noqa
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais inválidas",
        )

    token = create_access_token(
        data={"sub": user.username},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    return Token(
        access_token=token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
