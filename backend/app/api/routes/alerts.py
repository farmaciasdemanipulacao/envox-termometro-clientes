"""Endpoints de alertas — filtrados por tenant."""
from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.alert import AlertEvent, AlertStatus
from app.models.conversation import Conversation
from app.schemas.alert import AlertOut, AlertUpdateRequest

router = APIRouter()


@router.get(
    "/alerts",
    response_model=list[AlertOut],
    summary="Listar alertas",
)
async def list_alerts(
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tid = current_user.id
    query = (
        select(AlertEvent)
        .join(Conversation, AlertEvent.conversation_id == Conversation.id)
        .where(Conversation.tenant_id == tid)
        .order_by(AlertEvent.triggered_at.desc())
        .limit(limit)
    )
    if status:
        query = query.where(AlertEvent.status == status)
    if severity:
        query = query.where(AlertEvent.severity == severity)

    result = await db.execute(query)
    alerts = result.scalars().all()

    out = []
    for alert in alerts:
        conv_result = await db.execute(
            select(Conversation.name, Conversation.custom_name).where(
                Conversation.id == alert.conversation_id
            )
        )
        conv_row = conv_result.one_or_none()
        conv_name = (conv_row.custom_name or conv_row.name) if conv_row else None

        out.append(AlertOut(
            id=str(alert.id),
            conversation_id=str(alert.conversation_id),
            conversation_name=conv_name,
            message_id=str(alert.message_id) if alert.message_id else None,
            alert_type=alert.alert_type,
            severity=alert.severity,
            title=alert.title,
            description=alert.description,
            excerpt=alert.excerpt,
            status=alert.status,
            triggered_at=alert.triggered_at,
            resolved_at=alert.resolved_at,
        ))

    return out


@router.patch(
    "/alerts/{alert_id}",
    response_model=AlertOut,
    summary="Atualizar status de alerta",
)
async def update_alert_status(
    alert_id: str,
    payload: AlertUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tid = current_user.id
    result = await db.execute(
        select(AlertEvent)
        .join(Conversation, AlertEvent.conversation_id == Conversation.id)
        .where(AlertEvent.id == alert_id, Conversation.tenant_id == tid)
    )
    alert = result.scalar_one_or_none()

    if not alert:
        raise HTTPException(status_code=404, detail="Alerta não encontrado")

    valid_statuses = [s.value for s in AlertStatus]
    if payload.status not in valid_statuses:
        raise HTTPException(status_code=422, detail=f"Status inválido. Use: {valid_statuses}")

    alert.status = payload.status
    if payload.status == AlertStatus.RESOLVED:
        alert.resolved_at = datetime.now(timezone.utc)

    conv_result = await db.execute(
        select(Conversation.name, Conversation.custom_name).where(
            Conversation.id == alert.conversation_id
        )
    )
    conv_row = conv_result.one_or_none()
    conv_name = (conv_row.custom_name or conv_row.name) if conv_row else None

    return AlertOut(
        id=str(alert.id),
        conversation_id=str(alert.conversation_id),
        conversation_name=conv_name,
        message_id=str(alert.message_id) if alert.message_id else None,
        alert_type=alert.alert_type,
        severity=alert.severity,
        title=alert.title,
        description=alert.description,
        excerpt=alert.excerpt,
        status=alert.status,
        triggered_at=alert.triggered_at,
        resolved_at=alert.resolved_at,
    )
