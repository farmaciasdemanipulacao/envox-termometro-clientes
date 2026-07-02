"""Endpoints de assinaturas — admin only."""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.user import User
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.plan import Plan
from app.schemas.subscription import SubscriptionResponse, SubscriptionUpdate
from app.api.deps import get_current_admin_user

router = APIRouter()


def _resp(sub: Subscription, plan: Optional[Plan] = None) -> SubscriptionResponse:
    return SubscriptionResponse(
        id=str(sub.id),
        user_id=str(sub.user_id),
        plan_id=str(sub.plan_id),
        plan_name=plan.name if plan else None,
        plan_slug=plan.slug if plan else None,
        status=sub.status,
        trial_ends_at=sub.trial_ends_at,
        current_period_start=sub.current_period_start,
        current_period_end=sub.current_period_end,
        payment_ref=sub.payment_ref,
        cancelled_at=sub.cancelled_at,
        notes=sub.notes,
        created_at=sub.created_at,
    )


@router.get("/admin/subscriptions", response_model=list[dict])
async def list_subscriptions(
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    """Lista todas as assinaturas com dados de usuário e plano."""
    q = select(Subscription)
    if status:
        q = q.where(Subscription.status == status)
    q = q.order_by(Subscription.created_at.desc())
    subs = (await db.execute(q)).scalars().all()

    plans_map: dict = {}
    users_map: dict = {}

    plan_ids = list({str(s.plan_id) for s in subs})
    user_ids = list({str(s.user_id) for s in subs})

    if plan_ids:
        plans = (await db.execute(select(Plan).where(Plan.id.in_(plan_ids)))).scalars().all()
        plans_map = {str(p.id): p for p in plans}
    if user_ids:
        users = (await db.execute(select(User).where(User.id.in_(user_ids)))).scalars().all()
        users_map = {str(u.id): u for u in users}

    result = []
    for sub in subs:
        plan = plans_map.get(str(sub.plan_id))
        user = users_map.get(str(sub.user_id))
        result.append({
            "id": str(sub.id),
            "user_id": str(sub.user_id),
            "username": user.username if user else None,
            "full_name": user.full_name if user else None,
            "email": user.email if user else None,
            "company_name": user.company_name if user else None,
            "plan_id": str(sub.plan_id),
            "plan_name": plan.name if plan else None,
            "plan_slug": plan.slug if plan else None,
            "status": sub.status,
            "current_period_start": sub.current_period_start.isoformat() if sub.current_period_start else None,
            "current_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None,
            "payment_ref": sub.payment_ref,
            "notes": sub.notes,
            "created_at": sub.created_at.isoformat() if sub.created_at else None,
        })
    return result


@router.patch("/admin/subscriptions/{sub_id}", response_model=dict)
async def update_subscription(
    sub_id: str,
    payload: SubscriptionUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    sub = await db.get(Subscription, sub_id)
    if not sub:
        raise HTTPException(404, "Assinatura não encontrada")

    if payload.plan_id:
        plan = await db.get(Plan, payload.plan_id)
        if not plan:
            raise HTTPException(404, "Plano não encontrado")
        sub.plan_id = plan.id

    if payload.status:
        try:
            sub.status = SubscriptionStatus(payload.status)
        except ValueError:
            raise HTTPException(400, f"Status inválido: {payload.status}")
        if payload.status == SubscriptionStatus.CANCELLED:
            sub.cancelled_at = datetime.now(timezone.utc)

    if payload.notes is not None:
        sub.notes = payload.notes
    if payload.current_period_end is not None:
        sub.current_period_end = payload.current_period_end
    if payload.payment_ref is not None:
        sub.payment_ref = payload.payment_ref

    await db.commit()
    await db.refresh(sub)

    plan = await db.get(Plan, sub.plan_id)
    return {
        "id": str(sub.id),
        "status": sub.status,
        "plan_name": plan.name if plan else None,
        "current_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None,
    }


@router.get("/admin/stats", response_model=dict)
async def admin_stats(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    """Estatísticas gerais do sistema para o painel admin."""
    total_users = await db.scalar(select(func.count(User.id)))
    active_users = await db.scalar(select(func.count(User.id)).where(User.is_active == True))  # noqa
    active_subs = await db.scalar(
        select(func.count(Subscription.id)).where(Subscription.status == SubscriptionStatus.ACTIVE)
    )
    trial_subs = await db.scalar(
        select(func.count(Subscription.id)).where(Subscription.status == SubscriptionStatus.TRIAL)
    )
    cancelled_subs = await db.scalar(
        select(func.count(Subscription.id)).where(Subscription.status == SubscriptionStatus.CANCELLED)
    )
    total_plans = await db.scalar(select(func.count(Plan.id)).where(Plan.is_active == True))  # noqa

    # MRR simulado
    active_plan_subs = (await db.execute(
        select(Subscription, Plan)
        .join(Plan, Subscription.plan_id == Plan.id)
        .where(Subscription.status == SubscriptionStatus.ACTIVE)
    )).all()
    mrr = sum(row.Plan.price_monthly for row in active_plan_subs)

    return {
        "total_users": total_users or 0,
        "active_users": active_users or 0,
        "active_subscriptions": active_subs or 0,
        "trial_subscriptions": trial_subs or 0,
        "cancelled_subscriptions": cancelled_subs or 0,
        "total_active_plans": total_plans or 0,
        "mrr": mrr,
    }
