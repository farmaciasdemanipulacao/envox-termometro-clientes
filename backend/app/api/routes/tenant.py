"""
Endpoints de configuração e WhatsApp por tenant.
Cada usuário gerencia sua própria sessão WhatsApp e configurações aqui.
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
import httpx

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.tenant import TenantConfig
from app.connectors.wppconnect_server import get_client_for_session
from app.core.config import settings
from app.core.logging import get_logger

router = APIRouter()
logger = get_logger(__name__)


class TenantConfigUpdate(BaseModel):
    wpp_secret: Optional[str] = None
    wpp_url: Optional[str] = None


async def _require_tenant_config(user: User, db: AsyncSession) -> TenantConfig:
    result = await db.execute(select(TenantConfig).where(TenantConfig.tenant_id == user.id))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(
            status_code=404,
            detail="Configuração de WhatsApp não encontrada. Contate o administrador.",
        )
    return config


# ── Config ──────────────────────────────────────────────────────────────

@router.get("/tenant/config")
async def get_tenant_config(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(TenantConfig).where(TenantConfig.tenant_id == current_user.id)
    )
    config = result.scalar_one_or_none()
    if not config:
        return {"configured": False, "wpp_session": None, "wpp_url": None}
    return {
        "configured": True,
        "wpp_session": config.wpp_session,
        "wpp_url": config.wpp_url,
        "wpp_secret": config.wpp_secret,
    }


@router.put("/tenant/config")
async def update_tenant_config(
    payload: TenantConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    config = await _require_tenant_config(current_user, db)
    if payload.wpp_secret is not None:
        config.wpp_secret = payload.wpp_secret
    if payload.wpp_url is not None:
        config.wpp_url = payload.wpp_url
    await db.commit()
    return {"ok": True, "wpp_session": config.wpp_session}


# ── WhatsApp ─────────────────────────────────────────────────────────────

@router.get("/tenant/wpp/status")
async def get_wpp_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    config = await _require_tenant_config(current_user, db)
    client = get_client_for_session(config.wpp_url, config.wpp_session, config.wpp_secret)
    try:
        token = await client.generate_token()
        status = await client.get_status(token)
        current = status.get("status", "UNKNOWN")
        phone = status.get("phoneNumber") or status.get("pushname") or ""
        return {
            "connected": current in ("CONNECTED", "isLogged"),
            "status": current,
            "phone": phone,
            "session": config.wpp_session,
        }
    except Exception as e:
        return {"connected": False, "status": "ERROR", "phone": "", "error": str(e)}


@router.post("/tenant/wpp/start")
async def start_wpp_session(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Inicia ou reconecta a sessão WppConnect do tenant. Retorna QR code se necessário."""
    config = await _require_tenant_config(current_user, db)
    client = get_client_for_session(config.wpp_url, config.wpp_session, config.wpp_secret)
    try:
        token = await client.generate_token()
        result = await client.start_session(token, settings.WPP_WEBHOOK_URL)
        status = result.get("status", "UNKNOWN")

        # QR embutido na resposta do start-session (às vezes vem aqui)
        qr_embedded = result.get("qrcode") or result.get("qr") or None

        return {
            "status": status,
            "connected": status in ("CONNECTED", "isLogged"),
            "qrcode": qr_embedded,
            "token": token,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tenant/wpp/qr")
async def get_wpp_qr(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retorna o QR code como PNG para escaneamento. Proxeia do WppConnect."""
    config = await _require_tenant_config(current_user, db)
    client = get_client_for_session(config.wpp_url, config.wpp_session, config.wpp_secret)
    try:
        token = await client.generate_token()
        qr_bytes = await client.get_qr(token)
        if qr_bytes:
            return Response(content=qr_bytes, media_type="image/png")
        return Response(status_code=204)  # Sem QR disponível (sessão já conectada)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tenant/wpp/disconnect")
async def disconnect_wpp(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    config = await _require_tenant_config(current_user, db)
    client = get_client_for_session(config.wpp_url, config.wpp_session, config.wpp_secret)
    try:
        token = await client.generate_token()
        await client.logout(token)
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}
