"""Admin: criação de campanhas de push manuais + relatório de interatividade por usuário."""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.db.session import get_db
from app.models.user import User
from app.models.push_subscription import PushSubscription
from app.models.push_campaign import PushCampaign, PushCampaignStatus, PushCampaignTargetType
from app.models.push_delivery import PushDelivery, PushDeliveryStatus
from app.api.deps import get_current_admin_user
from app.core.logging import get_logger

router = APIRouter()
logger = get_logger(__name__)


class CreateCampaignRequest(BaseModel):
    title: str
    body: str
    url: str = "/"
    tag: str = "atenx-campaign"
    target_type: str  # "all" | "specific"
    user_ids: Optional[list[str]] = None


def _campaign_summary(c: PushCampaign, counts: dict) -> dict:
    sent = counts.get("sent", 0)
    failed = counts.get("failed", 0)
    clicked = counts.get("clicked", 0)
    total = counts.get("total", 0)
    return {
        "id": str(c.id),
        "title": c.title,
        "body": c.body,
        "url": c.url,
        "target_type": c.target_type.value if hasattr(c.target_type, "value") else c.target_type,
        "status": c.status.value if hasattr(c.status, "value") else c.status,
        "created_at": c.created_at,
        "started_at": c.started_at,
        "completed_at": c.completed_at,
        "total": total,
        "sent": sent,
        "failed": failed,
        "clicked": clicked,
        "click_rate": round(clicked / sent * 100, 1) if sent else 0.0,
    }


@router.post("/admin/push/campaigns", status_code=201)
async def create_campaign(
    payload: CreateCampaignRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    """Cria e dispara (em background) uma campanha de push manual."""
    if payload.target_type not in ("all", "specific"):
        raise HTTPException(status_code=400, detail="target_type deve ser 'all' ou 'specific'")
    if payload.target_type == "specific" and not payload.user_ids:
        raise HTTPException(status_code=400, detail="Informe ao menos um usuário para target_type='specific'")
    if not payload.title.strip() or not payload.body.strip():
        raise HTTPException(status_code=400, detail="Título e corpo são obrigatórios")

    campaign = PushCampaign(
        title=payload.title.strip(),
        body=payload.body.strip(),
        url=payload.url or "/",
        tag=payload.tag or "atenx-campaign",
        target_type=PushCampaignTargetType(payload.target_type),
        target_user_ids=payload.user_ids if payload.target_type == "specific" else None,
        status=PushCampaignStatus.QUEUED,
        created_by=admin.id,
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)

    # Dispara imediatamente em background — não bloqueia a resposta HTTP.
    # Se o processo cair no meio, o sweep job (scheduler) retoma sozinho depois
    # (ver PUSH_CAMPAIGN_SWEEP_INTERVAL_MIN / run_push_campaign_sweep_job).
    import asyncio
    from app.services.push import process_campaign
    asyncio.create_task(process_campaign(campaign.id))

    return _campaign_summary(campaign, {})


async def _counts_by_campaign(db) -> dict:
    result = await db.execute(
        select(
            PushDelivery.campaign_id,
            PushDelivery.status,
            func.count(PushDelivery.id),
            func.count(PushDelivery.clicked_at),
        ).where(PushDelivery.campaign_id.isnot(None)).group_by(PushDelivery.campaign_id, PushDelivery.status)
    )
    out: dict = {}
    for campaign_id, status, count, clicked_count in result.all():
        c = out.setdefault(campaign_id, {"total": 0, "sent": 0, "failed": 0, "clicked": 0})
        c["total"] += count
        if status == PushDeliveryStatus.SENT:
            c["sent"] += count
            c["clicked"] += clicked_count
        elif status == PushDeliveryStatus.FAILED:
            c["failed"] += count
    return out


@router.get("/admin/push/campaigns")
async def list_campaigns(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    """Lista campanhas com progresso agregado (enviados/falhas/cliques)."""
    campaigns = (await db.execute(select(PushCampaign).order_by(PushCampaign.created_at.desc()))).scalars().all()
    counts_map = await _counts_by_campaign(db)
    return [_campaign_summary(c, counts_map.get(c.id, {})) for c in campaigns]


@router.get("/admin/push/campaigns/{campaign_id}")
async def get_campaign(
    campaign_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    """Detalhe de uma campanha, com quebra por usuário/dispositivo."""
    try:
        cid = uuid.UUID(campaign_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID inválido")

    campaign = await db.get(PushCampaign, cid)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campanha não encontrada")

    deliveries = (await db.execute(
        select(PushDelivery).where(PushDelivery.campaign_id == cid).order_by(PushDelivery.created_at)
    )).scalars().all()

    user_ids = list({d.user_id for d in deliveries})
    users_map = {}
    if user_ids:
        users = (await db.execute(select(User).where(User.id.in_(user_ids)))).scalars().all()
        users_map = {u.id: u for u in users}

    counts_map = await _counts_by_campaign(db)
    return {
        **_campaign_summary(campaign, counts_map.get(cid, {})),
        "deliveries": [
            {
                "id": str(d.id),
                "user_id": str(d.user_id),
                "user_name": (users_map.get(d.user_id).full_name or users_map.get(d.user_id).username) if users_map.get(d.user_id) else "—",
                "status": d.status.value if hasattr(d.status, "value") else d.status,
                "error": d.error,
                "sent_at": d.sent_at,
                "clicked_at": d.clicked_at,
            }
            for d in deliveries
        ],
    }


@router.get("/admin/push/users")
async def list_push_users(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    """Lista usuários com contagem de dispositivos inscritos — usado no seletor de destino da campanha."""
    users = (await db.execute(select(User).order_by(User.full_name, User.username))).scalars().all()
    sub_counts_result = await db.execute(
        select(PushSubscription.user_id, func.count(PushSubscription.id)).group_by(PushSubscription.user_id)
    )
    sub_counts = dict(sub_counts_result.all())

    return [
        {
            "id": str(u.id),
            "name": u.full_name or u.username,
            "email": u.email,
            "device_count": sub_counts.get(u.id, 0),
        }
        for u in users
    ]


@router.get("/admin/push/stats")
async def push_interactivity_stats(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    """Relatório de interatividade por usuário: enviados, cliques, taxa, última atividade — inclui alertas automáticos e campanhas."""
    result = await db.execute(
        select(
            PushDelivery.user_id,
            PushDelivery.status,
            func.count(PushDelivery.id),
            func.count(PushDelivery.clicked_at),
            func.max(PushDelivery.sent_at),
            func.max(PushDelivery.clicked_at),
        ).group_by(PushDelivery.user_id, PushDelivery.status)
    )
    rows = result.all()

    per_user: dict = {}
    for user_id, status, count, clicked_count, last_sent, last_clicked in rows:
        acc = per_user.setdefault(user_id, {
            "sent": 0, "failed": 0, "clicked": 0, "last_sent_at": None, "last_clicked_at": None,
        })
        if status == PushDeliveryStatus.SENT:
            acc["sent"] += count
            acc["clicked"] += clicked_count
        elif status == PushDeliveryStatus.FAILED:
            acc["failed"] += count
        if last_sent and (acc["last_sent_at"] is None or last_sent > acc["last_sent_at"]):
            acc["last_sent_at"] = last_sent
        if last_clicked and (acc["last_clicked_at"] is None or last_clicked > acc["last_clicked_at"]):
            acc["last_clicked_at"] = last_clicked

    if not per_user:
        return []

    users = (await db.execute(select(User).where(User.id.in_(per_user.keys())))).scalars().all()
    sub_counts_result = await db.execute(
        select(PushSubscription.user_id, func.count(PushSubscription.id))
        .where(PushSubscription.user_id.in_(per_user.keys()))
        .group_by(PushSubscription.user_id)
    )
    sub_counts = dict(sub_counts_result.all())
    users_map = {u.id: u for u in users}

    out = []
    for user_id, acc in per_user.items():
        u = users_map.get(user_id)
        out.append({
            "user_id": str(user_id),
            "name": (u.full_name or u.username) if u else "(usuário removido)",
            "email": u.email if u else None,
            "device_count": sub_counts.get(user_id, 0),
            "sent": acc["sent"],
            "failed": acc["failed"],
            "clicked": acc["clicked"],
            "click_rate": round(acc["clicked"] / acc["sent"] * 100, 1) if acc["sent"] else 0.0,
            "last_sent_at": acc["last_sent_at"],
            "last_clicked_at": acc["last_clicked_at"],
        })

    out.sort(key=lambda r: r["last_sent_at"] or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    return out
