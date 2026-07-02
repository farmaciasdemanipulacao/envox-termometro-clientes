"""Endpoint público de registro de novo usuário (self-service SaaS)."""
from datetime import timedelta, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.models.user import User
from app.models.tenant import TenantConfig
from app.models.source import IngestionSource, SourceType
from app.models.plan import Plan
from app.models.subscription import Subscription, SubscriptionStatus
from app.schemas.auth import RegisterRequest, Token
from app.core.security import hash_password, generate_api_key, create_access_token
from app.core.config import settings

router = APIRouter()


def _session_name_for(username: str, suffix: str = "") -> str:
    slug = username.replace(".", "-").replace("_", "-").replace(" ", "-").lower()
    base = f"envox-{slug}"[:54]
    return f"{base}-{suffix}" if suffix else base[:60]


@router.post("/auth/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Cria conta + assinatura (pagamento simulado) e retorna token de acesso."""
    if await db.scalar(select(User).where(User.username == payload.username)):
        raise HTTPException(400, "Username já existe")
    if await db.scalar(select(User).where(User.email == payload.email)):
        raise HTTPException(400, "E-mail já cadastrado")
    if len(payload.password) < 6:
        raise HTTPException(400, "Senha deve ter no mínimo 6 caracteres")

    plan = await db.scalar(
        select(Plan).where(Plan.slug == payload.plan_slug, Plan.is_active == True)  # noqa
    )
    if not plan:
        plan = await db.scalar(
            select(Plan).where(Plan.is_active == True).order_by(Plan.display_order)  # noqa
        )
    if not plan:
        raise HTTPException(400, "Nenhum plano disponível no momento")

    user = User(
        username=payload.username,
        full_name=payload.full_name,
        email=payload.email,
        company_name=payload.company_name or None,
        phone=payload.phone or None,
        hashed_password=hash_password(payload.password),
        is_active=True,
        is_admin=False,
    )
    db.add(user)
    await db.flush()

    session_name = _session_name_for(payload.username)
    if await db.scalar(select(TenantConfig).where(TenantConfig.wpp_session == session_name)):
        session_name = _session_name_for(payload.username, user.id.hex[:6])

    tenant_cfg = TenantConfig(
        tenant_id=user.id,
        wpp_session=session_name,
        wpp_secret=settings.WPP_SECRET,
        wpp_url=settings.WPP_BASE_URL,
    )
    db.add(tenant_cfg)

    _, api_key_hash = generate_api_key()
    wpp_source = IngestionSource(
        tenant_id=user.id,
        name=f"WppConnect - {payload.username}",
        description=f"Ingestão WhatsApp para {payload.full_name}",
        source_type=SourceType.WEBHOOK,
        api_key_hash=api_key_hash,
        is_active=True,
    )
    db.add(wpp_source)

    now = datetime.now(timezone.utc)
    subscription = Subscription(
        user_id=user.id,
        plan_id=plan.id,
        status=SubscriptionStatus.ACTIVE,
        current_period_start=now,
        current_period_end=now + timedelta(days=30),
        notes="Pagamento simulado — integração Asaas pendente",
    )
    db.add(subscription)

    await db.commit()
    await db.refresh(user)

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
        is_admin=False,
        subscription_status=SubscriptionStatus.ACTIVE,
        plan_name=plan.name,
    )
