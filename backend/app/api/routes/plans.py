"""Endpoints de planos — público (GET) e admin (CRUD)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.models.plan import Plan
from app.models.user import User
from app.schemas.plan import PlanResponse, PlanCreate, PlanUpdate
from app.api.deps import get_current_admin_user

router = APIRouter()


def _resp(p: Plan) -> PlanResponse:
    return PlanResponse(
        id=str(p.id),
        slug=p.slug,
        name=p.name,
        description=p.description,
        price_monthly=p.price_monthly,
        max_groups=p.max_groups,
        features=p.features or [],
        is_active=p.is_active,
        display_order=p.display_order,
        is_featured=p.is_featured,
    )


@router.get("/plans", response_model=list[PlanResponse])
async def list_plans(db: AsyncSession = Depends(get_db)):
    """Lista planos ativos (público — usado na landing page)."""
    result = await db.execute(
        select(Plan).where(Plan.is_active == True).order_by(Plan.display_order)  # noqa
    )
    return [_resp(p) for p in result.scalars().all()]


@router.get("/admin/plans", response_model=list[PlanResponse])
async def list_all_plans(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    result = await db.execute(select(Plan).order_by(Plan.display_order))
    return [_resp(p) for p in result.scalars().all()]


@router.post("/admin/plans", response_model=PlanResponse, status_code=201)
async def create_plan(
    payload: PlanCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    if await db.scalar(select(Plan).where(Plan.slug == payload.slug)):
        raise HTTPException(400, "Slug já existe")
    plan = Plan(**payload.model_dump())
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return _resp(plan)


@router.patch("/admin/plans/{plan_id}", response_model=PlanResponse)
async def update_plan(
    plan_id: str,
    payload: PlanUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    plan = await db.get(Plan, plan_id)
    if not plan:
        raise HTTPException(404, "Plano não encontrado")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(plan, field, value)
    await db.commit()
    await db.refresh(plan)
    return _resp(plan)
