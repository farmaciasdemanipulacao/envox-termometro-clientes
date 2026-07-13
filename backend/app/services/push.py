"""
Serviço de Web Push Notifications.
Usa VAPID para autenticar envios ao browser.

Todo envio (automático via alerta, ou manual via campanha do admin) passa por
`_deliver`, que grava um PushDelivery ANTES de tentar enviar. Isso é o que
permite retomar campanhas travadas: o sweep job (`run_push_campaign_sweep_job`
em core/scheduler.py) só precisa reprocessar os registros com status PENDING.
"""
import json
import uuid
from datetime import datetime, timezone
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
    delivery_id: Optional[str] = None,
) -> tuple[bool, Optional[str]]:
    """
    Envia uma Web Push notification para uma subscription específica.
    Retorna (sucesso, mensagem_de_erro).
    """
    if not settings.VAPID_PRIVATE_KEY or not settings.VAPID_PUBLIC_KEY:
        logger.warning("push_skipped_no_vapid")
        return False, "VAPID não configurado no servidor"

    try:
        from pywebpush import webpush, WebPushException

        payload = json.dumps({
            "title": title,
            "body": body,
            "url": url,
            "critical": critical,
            "tag": tag,
            "delivery_id": delivery_id,
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
        return True, None

    except Exception as exc:
        logger.error("push_failed", error=str(exc)[:200], endpoint=endpoint[:60])
        return False, str(exc)[:500]


async def _deliver(db, user_id, subscription, title, body, url, critical, tag, campaign_id=None) -> bool:
    """Grava o PushDelivery (status PENDING), envia, e atualiza o resultado. Uma unidade por dispositivo."""
    from app.models.push_delivery import PushDelivery, PushDeliveryStatus

    delivery = PushDelivery(
        user_id=user_id,
        subscription_id=subscription.id,
        endpoint=subscription.endpoint,
        campaign_id=campaign_id,
        title=title,
        body=body,
        tag=tag,
        status=PushDeliveryStatus.PENDING,
    )
    db.add(delivery)
    await db.commit()
    await db.refresh(delivery)

    ok, error = await send_push(
        endpoint=subscription.endpoint,
        p256dh=subscription.p256dh,
        auth=subscription.auth,
        title=title,
        body=body,
        url=url,
        critical=critical,
        tag=tag,
        delivery_id=str(delivery.id),
    )

    delivery.status = PushDeliveryStatus.SENT if ok else PushDeliveryStatus.FAILED
    delivery.error = error
    delivery.sent_at = datetime.now(timezone.utc)
    await db.commit()

    return ok


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
    Envia push para todas as subscriptions ativas de um usuário (alertas automáticos).
    Retorna número de envios com sucesso.
    """
    from sqlalchemy import select, delete
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
        ok = await _deliver(db, user_id, sub, title, body, url, critical, tag, campaign_id=None)
        if ok:
            count += 1
        else:
            # Endpoint morto (browser desinstalou o app) — remove a subscription
            dead_endpoints.append(sub.id)

    if dead_endpoints:
        await db.execute(
            delete(PushSubscription).where(PushSubscription.id.in_(dead_endpoints))
        )
        await db.commit()
        logger.info("push_dead_endpoints_removed", count=len(dead_endpoints))

    return count


async def process_campaign(campaign_id) -> None:
    """
    Processa (ou retoma) uma campanha de push do admin.
    Idempotente: só envia pra quem ainda não tem PushDelivery(campaign_id, status in SENT/FAILED)
    dessa campanha — por isso pode ser chamado de novo com segurança (fire-and-forget na criação
    E pelo sweep job periódico) sem duplicar envio se o processo cair no meio.
    """
    from sqlalchemy import select
    from app.db.session import AsyncSessionLocal
    from app.models.push_campaign import PushCampaign, PushCampaignStatus, PushCampaignTargetType
    from app.models.push_subscription import PushSubscription
    from app.models.push_delivery import PushDelivery, PushDeliveryStatus

    async with AsyncSessionLocal() as db:
        campaign = await db.get(PushCampaign, campaign_id)
        if not campaign or campaign.status == PushCampaignStatus.COMPLETED:
            return

        if campaign.status == PushCampaignStatus.QUEUED:
            campaign.status = PushCampaignStatus.SENDING
            campaign.started_at = campaign.started_at or datetime.now(timezone.utc)
            await db.commit()

        # Resolve o alvo: todas as subscriptions, ou só as dos usuários escolhidos
        sub_query = select(PushSubscription)
        if campaign.target_type == PushCampaignTargetType.SPECIFIC:
            target_ids = [uuid.UUID(u) for u in (campaign.target_user_ids or [])]
            if not target_ids:
                campaign.status = PushCampaignStatus.COMPLETED
                campaign.completed_at = datetime.now(timezone.utc)
                await db.commit()
                return
            sub_query = sub_query.where(PushSubscription.user_id.in_(target_ids))
        subscriptions = (await db.execute(sub_query)).scalars().all()

        # Já processadas nessa campanha (sent ou failed) — não reprocessa
        done_result = await db.execute(
            select(PushDelivery.subscription_id).where(
                PushDelivery.campaign_id == campaign.id,
                PushDelivery.status != PushDeliveryStatus.PENDING,
            )
        )
        done_sub_ids = {row[0] for row in done_result.all()}

        pending_subs = [s for s in subscriptions if s.id not in done_sub_ids]

        for sub in pending_subs:
            try:
                await _deliver(
                    db, sub.user_id, sub,
                    title=campaign.title, body=campaign.body,
                    url=campaign.url or "/", critical=False,
                    tag=campaign.tag or "atenx-campaign",
                    campaign_id=campaign.id,
                )
            except Exception as e:
                logger.error("push_campaign_deliver_failed", campaign_id=str(campaign.id), error=str(e))

        campaign.status = PushCampaignStatus.COMPLETED
        campaign.completed_at = datetime.now(timezone.utc)
        await db.commit()
        logger.info("push_campaign_completed", campaign_id=str(campaign.id), targets=len(subscriptions))
