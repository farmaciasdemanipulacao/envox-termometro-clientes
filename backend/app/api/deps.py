"""
Dependências compartilhadas da API (FastAPI Depends).
Auth, DB session, verificação de API Key.
"""
from typing import Optional, Annotated

from fastapi import Depends, HTTPException, Header, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.core.security import decode_access_token, verify_api_key, hash_api_key
from app.models.user import User
from app.models.source import IngestionSource
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)
security = HTTPBearer(auto_error=False)


# === JWT Auth (para usuários do dashboard) ===

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Valida JWT e retorna o usuário autenticado."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticação necessária",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado",
        )

    username = payload.get("sub")
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário não encontrado ou inativo",
        )

    return user


async def get_current_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """Exige que o usuário autenticado seja administrador."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito a administradores",
        )
    return current_user


# === API Key Auth (para conectores de ingestão) ===

async def get_ingest_source(
    x_api_key: Annotated[Optional[str], Header()] = None,
    db: AsyncSession = Depends(get_db),
) -> IngestionSource:
    """
    Valida X-API-Key e retorna a IngestionSource correspondente.
    Em desenvolvimento, aceita a API key padrão da config.
    """
    if not x_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="X-API-Key header obrigatório para ingestão",
        )

    # Busca source com este hash de API Key
    # .limit(1) + first() em vez de scalar_one_or_none(): defesa extra contra
    # colisão de api_key_hash (já corrigida na raiz em D-027, mas isso evita
    # que a rota derrube com 500 caso um dado duplicado volte a aparecer.
    key_hash = hash_api_key(x_api_key)
    result = await db.execute(
        select(IngestionSource).where(
            IngestionSource.api_key_hash == key_hash,
            IngestionSource.is_active == True,  # noqa
        ).order_by(IngestionSource.created_at.asc()).limit(1)
    )
    source = result.scalars().first()

    if not source:
        # Em desenvolvimento, aceita API key da config
        if settings.is_development and x_api_key == settings.API_KEY_SECRET:
            # Busca ou usa source padrão de desenvolvimento
            dev_result = await db.execute(
                select(IngestionSource).where(IngestionSource.name == "Development Default")
            )
            source = dev_result.scalar_one_or_none()

    if not source:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API Key inválida ou inativa",
        )

    return source
