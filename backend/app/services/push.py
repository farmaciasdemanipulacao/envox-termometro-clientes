"""
Serviço de Web Push Notifications.
Usa VAPID para autenticar envios ao browser.
"""
import json
from typing import Optional

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


def _get_vapid_claims():
    return {"sub": f"mailto:{settings.VAPID_CLAIM_EMAIL}"}


async def send_push(
    endpoint: str,
    p256dh: str,
    auth: str,
    title: str,
    body: str,
    url: str = "/",
    critical: bool = False,
    tag: str = "envox-alert",
) -> bool:
    """
    Envia uma Web Push notification para uma subscription específica.
    Retorna True se enviou com sucesso, False caso contrário.
    """
    if not settings.VAPID_PRIVATE_KEY or not settings.VAPID_PUBLIC_KEY:
        logger.warning("push_skipped_no_vapid")
        return False

    try:
        from pywebpush import webpush, WebPushException

        payload = json.dumps({
            "title": title,
            "body": body,
            "url": url,
            "critical": critical,
            "tag": tag,
        })

        webpush(
            subscription_info={
                "endpoint": endpoint,
                "keys": {"p256dh": p256dh, "auth": auth},
            },
            data=payload,
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims=_get_vapid_claims(),
        )
        logger.info("push_sent", endpoint=endpoint[:60], title=title)
        return True

    except Exception as exc:
        logger.error("push_failed", error=str(exc)[:200], endpoint=endpoint[:60])
        return False


async def broadcast_push(
    db,
    user_id,
    title: str,
    body: str,
    url: str = "/",
    critical: bool = False,
    tag: str = "envox-alert",
) -> int:
    """
    Envia push para todas as subscriptions ativas de um usuário.
    Retorna número de envios com sucesso.
    """
    from sqlalchemy import select
    from app.models.push_subscription import PushSubscription

    result = await db.execute(
        select(PushSubscription).where(PushSubscription.user_id == user_id)
    )
    subscriptions = result.scalars().all()

    if not subscriptions:
        return 0

    count = 0
    dead_endpoints = []

    for sub in subscriptions:
        ok = await send_push(
            endpoint=sub.endpoint,
            p256dh=sub.p256dh,
            auth=sub.auth,
            title=title,
            body=body,
            url=url,
            critical=critical,
            tag=tag,
        )
        if ok:
            count += 1
        else:
            # Endpoint morto (browser desinstalou o app) — remove
            dead_endpoints.append(sub.id)

    if dead_endpoints:
        from sqlalchemy import delete
        await db.execute(
            delete(PushSubscription).where(PushSubscription.id.in_(dead_endpoints))
        )
        await db.commit()
        logger.info("push_dead_endpoints_removed", count=len(dead_endpoints))

    return count
