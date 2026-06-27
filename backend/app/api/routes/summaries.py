"""Endpoints de resumos diários e briefing de fim de dia."""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.summary import DailySummary, SummaryType
from app.schemas.summary import DailySummaryOut
from app.services.analysis.summarizer import summary_service
from app.services.analysis.briefing import briefing_service

router = APIRouter()


@router.get(
    "/summaries",
    response_model=list[DailySummaryOut],
    summary="Listar resumos diários",
)
async def list_summaries(
    summary_type: str = Query("global", description="global|per_conversation"),
    limit: int = Query(30, le=90),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(DailySummary)
        .where(
            DailySummary.summary_type == summary_type,
            DailySummary.tenant_id == current_user.id,
        )
        .order_by(DailySummary.summary_date.desc())
        .limit(limit)
    )
    summaries = result.scalars().all()
    return [_to_out(s) for s in summaries]


@router.get(
    "/summaries/today",
    response_model=Optional[DailySummaryOut],
    summary="Resumo de hoje",
)
async def get_today_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    result = await db.execute(
        select(DailySummary).where(
            and_(
                DailySummary.summary_date == today,
                DailySummary.summary_type == SummaryType.GLOBAL,
                DailySummary.conversation_id.is_(None),
                DailySummary.tenant_id == current_user.id,
            )
        )
    )
    summary = result.scalar_one_or_none()
    if not summary:
        return None
    return _to_out(summary)


@router.post(
    "/summaries/generate",
    response_model=DailySummaryOut,
    summary="Gerar resumo do dia (sob demanda)",
    description="Força a geração do resumo para a data informada (padrão: hoje).",
)
async def generate_summary(
    target_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    summary = await summary_service.generate_daily_summary(db, target_date)
    return _to_out(summary)


@router.get(
    "/briefings/today",
    summary="Briefing de fim de dia de hoje",
)
async def get_today_briefing(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    result = await db.execute(
        select(DailySummary).where(
            and_(
                DailySummary.summary_date == today,
                DailySummary.summary_type == "briefing_eod",
                DailySummary.tenant_id == current_user.id,
            )
        )
    )
    summary = result.scalar_one_or_none()
    if not summary:
        return None
    return _to_out_briefing(summary)


@router.post(
    "/briefings/generate",
    summary="Gerar briefing de fim de dia (sob demanda / teste)",
)
async def generate_briefing(
    target_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    summary = await briefing_service.generate_eod_briefing(db, target_date)
    await db.commit()
    return _to_out_briefing(summary)


def _to_out_briefing(s: DailySummary) -> dict:
    extra = s.extra_data or {}
    return {
        "id": str(s.id),
        "summary_date": s.summary_date.isoformat() if s.summary_date else None,
        "executive_text": s.executive_text,
        "highlights": s.highlights or [],
        "critical_points": s.critical_points or [],
        "pending_followups": s.pending_followups or [],
        "temperature_score": s.temperature_score,
        "temperature_label": s.temperature_label,
        "generated_at": s.generated_at.isoformat() if s.generated_at else None,
        "generation_method": s.generation_method,
        "action_items": extra.get("action_items", []),
        "group_summary": extra.get("group_summary", []),
    }


def _to_out(s: DailySummary) -> DailySummaryOut:
    return DailySummaryOut(
        id=str(s.id),
        summary_date=s.summary_date,
        summary_type=s.summary_type,
        executive_text=s.executive_text,
        highlights=s.highlights or [],
        critical_points=s.critical_points or [],
        opportunities=s.opportunities or [],
        pending_followups=s.pending_followups or [],
        recurring_themes=s.recurring_themes or [],
        total_messages=s.total_messages,
        total_participants=s.total_participants,
        avg_sentiment_score=s.avg_sentiment_score,
        risk_score_avg=s.risk_score_avg,
        open_alerts_count=s.open_alerts_count,
        critical_alerts_count=s.critical_alerts_count,
        followups_pending=s.followups_pending,
        opportunities_count=s.opportunities_count,
        avg_response_minutes=s.avg_response_minutes,
        temperature_score=s.temperature_score,
        temperature_label=s.temperature_label,
        generated_at=s.generated_at,
        generation_method=s.generation_method,
    )
