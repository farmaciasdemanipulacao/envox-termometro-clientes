"""Endpoints de gerenciamento de usuários (admin only) e perfil próprio."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db.session import get_db
from app.models.user import User
from app.models.tenant import TenantConfig
from app.models.source import IngestionSource, SourceType
from app.models.conversation import Conversation
from app.models.message import Message
from app.schemas.auth import UserCreate, UserUpdate, UserMeUpdate, UserResponse, UserStatsResponse
from app.core.security import hash_password, generate_api_key
from app.core.config import settings
from app.api.deps import get_current_user, get_current_admin_user

router = APIRouter()


def _session_name_for(username: str) -> str:
    slug = username.replace(".", "-").replace("_", "-").replace(" ", "-").lower()
    return f"envox-{slug}"[:60]


def _to_response(u: User) -> UserResponse:
    return UserResponse(
        id=str(u.id),
        username=u.username,
        full_name=u.full_name,
        email=u.email,
        is_active=u.is_active,
        is_admin=u.is_admin,
        last_login_at=u.last_login_at,
        created_at=u.created_at,
    )


# ── Perfil próprio ────────────────────────────────────────────

@router.get("/users/me", response_model=UserResponse)
async def get_my_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _to_response(current_user)


@router.patch("/users/me", response_model=UserResponse)
async def update_my_profile(
    payload: UserMeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.full_name is not None:
        current_user.full_name = payload.full_name or None

    if payload.email is not None:
        new_email = payload.email.strip() if payload.email else None
        if new_email:
            dup = await db.execute(
                select(User).where(User.email == new_email, User.id != current_user.id)
            )
            if dup.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="E-mail já cadastrado")
        current_user.email = new_email

    if payload.password:
        if len(payload.password) < 6:
            raise HTTPException(status_code=400, detail="Senha deve ter no mínimo 6 caracteres")
        current_user.hashed_password = hash_password(payload.password)

    await db.commit()
    await db.refresh(current_user)
    return _to_response(current_user)


# ── Admin: listagem e stats ───────────────────────────────────

@router.get("/users/stats", response_model=list[UserStatsResponse])
async def list_users_stats(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    """Retorna lista de usuários com contagem de conversas e mensagens."""
    users_result = await db.execute(select(User).order_by(User.created_at))
    users = users_result.scalars().all()

    # Contagem de conversas por tenant
    conv_result = await db.execute(
        select(Conversation.tenant_id, func.count(Conversation.id).label("cnt"))
        .group_by(Conversation.tenant_id)
    )
    conv_map = {str(row.tenant_id): row.cnt for row in conv_result if row.tenant_id}

    # Contagem de mensagens por tenant (via conversations)
    msg_result = await db.execute(
        select(Conversation.tenant_id, func.count(Message.id).label("cnt"))
        .join(Message, Message.conversation_id == Conversation.id)
        .group_by(Conversation.tenant_id)
    )
    msg_map = {str(row.tenant_id): row.cnt for row in msg_result if row.tenant_id}

    return [
        UserStatsResponse(
            id=str(u.id),
            username=u.username,
            full_name=u.full_name,
            email=u.email,
            is_active=u.is_active,
            is_admin=u.is_admin,
            last_login_at=u.last_login_at,
            created_at=u.created_at,
            conversations_count=conv_map.get(str(u.id), 0),
            messages_count=msg_map.get(str(u.id), 0),
        )
        for u in users
    ]


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    result = await db.execute(select(User).order_by(User.created_at))
    return [_to_response(u) for u in result.scalars().all()]


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    existing = await db.execute(select(User).where(User.username == payload.username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username já existe")

    if payload.email:
        dup_email = await db.execute(select(User).where(User.email == payload.email))
        if dup_email.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="E-mail já cadastrado")

    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Senha deve ter no mínimo 6 caracteres")

    session_name = _session_name_for(payload.username)
    dup_session = await db.execute(
        select(TenantConfig).where(TenantConfig.wpp_session == session_name)
    )
    if dup_session.scalar_one_or_none():
        session_name = f"{session_name}-2"

    user = User(
        username=payload.username,
        full_name=payload.full_name,
        email=payload.email or None,
        hashed_password=hash_password(payload.password),
        is_active=True,
        is_admin=payload.is_admin,
    )
    db.add(user)
    await db.flush()

    tenant_cfg = TenantConfig(
        tenant_id=user.id,
        wpp_session=session_name,
        wpp_secret=settings.WPP_SECRET,
        wpp_url=settings.WPP_BASE_URL,
    )
    db.add(tenant_cfg)

    api_key_plain, api_key_hash = generate_api_key()
    wpp_source = IngestionSource(
        tenant_id=user.id,
        name=f"WppConnect - {payload.username}",
        description=f"Ingestão WhatsApp para {payload.full_name or payload.username}",
        source_type=SourceType.WEBHOOK,
        api_key_hash=api_key_hash,
        is_active=True,
    )
    db.add(wpp_source)

    await db.commit()
    await db.refresh(user)
    return _to_response(user)


@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.email is not None:
        user.email = payload.email or None
    if payload.is_admin is not None:
        user.is_admin = payload.is_admin
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.password:
        if len(payload.password) < 6:
            raise HTTPException(status_code=400, detail="Senha deve ter no mínimo 6 caracteres")
        user.hashed_password = hash_password(payload.password)

    await db.commit()
    await db.refresh(user)
    return _to_response(user)


@router.patch("/users/{user_id}/toggle-active", response_model=UserResponse)
async def toggle_user_active(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    if str(user.id) == str(admin.id):
        raise HTTPException(status_code=400, detail="Não é possível desativar sua própria conta")

    user.is_active = not user.is_active
    await db.commit()
    await db.refresh(user)
    return _to_response(user)
