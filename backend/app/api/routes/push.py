"""Endpoints de Web Push — subscribe, unsubscribe, test, vapid-public-key."""
import uuid
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.push_subscription import PushSubscription
from app.core.config import settings
from app.core.logging import get_logger

router = APIRouter(prefix="/push", tags=["Push Notifications"])
logger = get_logger(__name__)


class SubscribeRequest(BaseModel):
    endpoint: str
    p256dh: str
    auth: str
    user_agent: str = ""


@router.get("/vapid-public-key")
async def get_vapid_public_key():
    """Retorna a chave pública VAPID para o frontend montar a subscription."""
    if not settings.VAPID_PUBLIC_KEY:
        raise HTTPException(status_code=503, detail="Push não configurado no servidor")
    return {"public_key": settings.VAPID_PUBLIC_KEY}


@router.post("/subscribe")
async def subscribe(
    payload: SubscribeRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Registra (ou atualiza) uma subscription de push para o usuário autenticado."""
    # Upsert: se o endpoint já existe para este usuário, atualiza as chaves
    result = await db.execute(
        select(PushSubscription).where(
            PushSubscription.endpoint == payload.endpoint,
            PushSubscription.user_id == current_user.id,
        )
    )
    sub = result.scalar_one_or_none()

    ua = payload.user_agent or request.headers.get("user-agent", "")[:500]

    if sub:
        sub.p256dh = payload.p256dh
        sub.auth = payload.auth
        sub.user_agent = ua
    else:
        sub = PushSubscription(
            user_id=current_user.id,
            endpoint=payload.endpoint,
            p256dh=payload.p256dh,
            auth=payload.auth,
            user_agent=ua,
        )
        db.add(sub)

    await db.commit()
    logger.info("push_subscribed", user=str(current_user.id), endpoint=payload.endpoint[:60])
    return {"status": "subscribed"}


@router.delete("/unsubscribe")
async def unsubscribe(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove subscription do usuário."""
    endpoint = payload.get("endpoint", "")
    await db.execute(
        delete(PushSubscription).where(
            PushSubscription.user_id == current_user.id,
            PushSubscription.endpoint == endpoint,
        )
    )
    await db.commit()
    return {"status": "unsubscribed"}


@router.post("/test")
async def test_push(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Envia uma push de teste para o usuário autenticado."""
    from app.services.push import broadcast_push
    sent = await broadcast_push(
        db=db,
        user_id=current_user.id,
        title="ATENX",
        body="Notificações ativas! Você receberá alertas críticos aqui.",
        url="/",
        critical=False,
        tag="envox-test",
    )
    if sent == 0:
        raise HTTPException(status_code=404, detail="Nenhuma subscription ativa encontrada")
    return {"sent": sent}


class TrackClickRequest(BaseModel):
    delivery_id: str


@router.post("/track-click")
async def track_click(payload: TrackClickRequest, db: AsyncSession = Depends(get_db)):
    """
    Chamado pelo Service Worker (sw.js, notificationclick) quando o usuário toca
    numa notificação. Sem auth de propósito: o SW não tem acesso ao localStorage/JWT,
    e o delivery_id é um UUID não-adivinhável — só marca clicked_at, não expõe nada.
    """
    from app.models.push_delivery import PushDelivery

    try:
        delivery_uuid = uuid.UUID(payload.delivery_id)
    except ValueError:
        return {"status": "ignored"}

    delivery = await db.get(PushDelivery, delivery_uuid)
    if delivery and delivery.clicked_at is None:
        from datetime import datetime, timezone
        delivery.clicked_at = datetime.now(timezone.utc)
        await db.commit()
    return {"status": "ok"}
