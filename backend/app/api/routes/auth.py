"""Endpoints de autenticação."""
from datetime import timedelta, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.user import User
from app.models.subscription import Subscription
from app.models.plan import Plan
from app.schemas.auth import LoginRequest, Token
from app.core.security import verify_password, create_access_token
from app.core.config import settings

router = APIRouter()


@router.post("/auth/token", response_model=Token)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(User.username == request.username, User.is_active == True)  # noqa
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais inválidas",
        )

    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()

    # Busca assinatura e plano
    sub_result = await db.execute(
        select(Subscription).where(Subscription.user_id == user.id)
    )
    sub = sub_result.scalar_one_or_none()
    plan_name = None
    sub_status = None
    max_history_days = 90  # default conservador
    max_groups = 5
    if sub:
        sub_status = sub.status
        plan = await db.get(Plan, sub.plan_id)
        if plan:
            plan_name = plan.name
            max_history_days = plan.max_history_days
            max_groups = plan.max_groups

    token = create_access_token(
        data={"sub": user.username},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    return Token(
        access_token=token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user_id=str(user.id),
        username=user.username,
        full_name=user.full_name,
        is_admin=user.is_admin,
        subscription_status=sub_status,
        plan_name=plan_name,
        max_history_days=max_history_days,
        max_groups=max_groups,
    )
