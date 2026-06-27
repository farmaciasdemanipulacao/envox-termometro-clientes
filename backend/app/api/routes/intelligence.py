"""
Inteligência Operacional — itens acionáveis agregados, filtrados por tenant.
"""
from datetime import datetime, date, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc, func, text, exists

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.message import Message
from app.models.conversation import Conversation
from app.models.participant import Participant
from app.models.alert import AlertEvent, AlertStatus, AlertSeverity
from app.models.followup import FollowUpItem, FollowUpStatus

router = APIRouter()

SEVERITY_ORDER = {AlertSeverity.CRITICAL: 0, AlertSeverity.HIGH: 1,
                  AlertSeverity.MEDIUM: 2, AlertSeverity.LOW: 3}


def _conv_display(conv: Conversation) -> str:
    return conv.custom_name or conv.name


def _part_display(part: Participant) -> str:
    return part.custom_name or part.name


@router.get("/intelligence/items")
async def get_intelligence_items(
    item_type: str = Query("all", description="all|alerts|opportunities|churn|followups"),
    limit: int = Query(30, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items = []
    today_start = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc)
    since = today_start - timedelta(days=7)
    tid = current_user.id

    if item_type in ("all", "alerts"):
        result = await db.execute(
            select(AlertEvent, Conversation)
            .join(Conversation, AlertEvent.conversation_id == Conversation.id)
            .where(AlertEvent.status == AlertStatus.OPEN, Conversation.tenant_id == tid)
            .order_by(AlertEvent.triggered_at.desc())
            .limit(limit)
        )
        for alert, conv in result.fetchall():
            items.append({
                "kind": "alert",
                "id": str(alert.id),
                "conversation_id": str(alert.conversation_id),
                "conversation_name": _conv_display(conv),
                "title": alert.title,
                "description": alert.description or "",
                "severity": alert.severity,
                "alert_type": alert.alert_type,
                "timestamp": alert.triggered_at.isoformat() if alert.triggered_at else None,
                "status": alert.status,
            })

    if item_type in ("all", "opportunities"):
        result = await db.execute(
            select(Message, Conversation, Participant)
            .join(Conversation, Message.conversation_id == Conversation.id)
            .join(Participant, Message.participant_id == Participant.id)
            .where(
                Message.is_opportunity == True,  # noqa
                Message.sent_at >= since,
                Conversation.tenant_id == tid,
            )
            .order_by(Message.sent_at.desc())
            .limit(limit)
        )
        for msg, conv, part in result.fetchall():
            items.append({
                "kind": "opportunity",
                "id": str(msg.id),
                "conversation_id": str(msg.conversation_id),
                "conversation_name": _conv_display(conv),
                "title": "Oportunidade detectada",
                "description": (msg.content or "")[:200],
                "sender": _part_display(part),
                "risk_score": msg.risk_score,
                "opportunity_score": msg.opportunity_score,
                "tags": msg.tags or [],
                "timestamp": msg.sent_at.isoformat() if msg.sent_at else None,
            })

    if item_type in ("all", "churn"):
        result = await db.execute(
            select(Message, Conversation, Participant)
            .join(Conversation, Message.conversation_id == Conversation.id)
            .join(Participant, Message.participant_id == Participant.id)
            .where(
                Message.is_churn_risk == True,  # noqa
                Message.sent_at >= since,
                Conversation.tenant_id == tid,
            )
            .order_by(Message.sent_at.desc())
            .limit(limit)
        )
        for msg, conv, part in result.fetchall():
            items.append({
                "kind": "churn",
                "id": str(msg.id),
                "conversation_id": str(msg.conversation_id),
                "conversation_name": _conv_display(conv),
                "title": "Risco de churn detectado",
                "description": (msg.content or "")[:200],
                "sender": _part_display(part),
                "risk_score": msg.risk_score,
                "tags": msg.tags or [],
                "timestamp": msg.sent_at.isoformat() if msg.sent_at else None,
            })

    if item_type in ("all", "followups"):
        result = await db.execute(
            select(FollowUpItem, Conversation)
            .join(Conversation, FollowUpItem.conversation_id == Conversation.id)
            .where(
                FollowUpItem.status.in_([FollowUpStatus.PENDING, FollowUpStatus.OVERDUE]),
                Conversation.tenant_id == tid,
            )
            .order_by(FollowUpItem.detected_at.desc())
            .limit(limit)
        )
        for fu, conv in result.fetchall():
            items.append({
                "kind": "followup",
                "id": str(fu.id),
                "conversation_id": str(fu.conversation_id),
                "conversation_name": _conv_display(conv),
                "title": fu.title,
                "description": fu.description or "",
                "status": fu.status,
                "timestamp": fu.detected_at.isoformat() if fu.detected_at else None,
            })

    kind_order = {"alert": 0, "churn": 1, "followup": 2, "opportunity": 3}
    items.sort(key=lambda x: (kind_order.get(x["kind"], 9), -(
        datetime.fromisoformat(x["timestamp"]).timestamp() if x.get("timestamp") else 0
    )))

    return items[:limit]


async def _get_conv_for_tenant(conv_id, db, current_user) -> Conversation:
    """Busca conversa garantindo que pertence ao tenant atual."""
    import uuid as _uuid
    try:
        cid = _uuid.UUID(str(conv_id))
    except ValueError:
        raise HTTPException(400, "ID inválido")

    result = await db.execute(
        select(Conversation).where(
            Conversation.id == cid,
            Conversation.tenant_id == current_user.id,
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(404, "Conversa não encontrada")
    return conv


@router.get("/intelligence/context/{conversation_id}")
async def get_conversation_context(
    conversation_id: str,
    limit: int = Query(20, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv = await _get_conv_for_tenant(conversation_id, db, current_user)
    conv_id = conv.id

    result = await db.execute(
        select(Message, Participant)
        .join(Participant, Message.participant_id == Participant.id)
        .where(Message.conversation_id == conv_id)
        .order_by(Message.sent_at.desc())
        .limit(limit)
    )
    rows = result.fetchall()

    type_icons = {"text": "💬", "audio": "🎤", "image": "🖼️",
                  "document": "📄", "video": "📹", "sticker": "😊"}
    messages = []
    for msg, part in reversed(rows):
        messages.append({
            "id": str(msg.id),
            "content": msg.content or "",
            "message_type": msg.message_type,
            "type_icon": type_icons.get(msg.message_type, "💬"),
            "sender": _part_display(part),
            "sender_id": str(part.id),
            "sent_at": msg.sent_at.isoformat() if msg.sent_at else None,
            "risk_score": msg.risk_score,
            "is_churn_risk": msg.is_churn_risk,
            "is_opportunity": msg.is_opportunity,
            "tags": msg.tags or [],
        })

    return {
        "conversation": {
            "id": str(conv.id),
            "name": _conv_display(conv),
            "original_name": conv.name,
            "custom_name": conv.custom_name,
        },
        "messages": messages,
    }


@router.get("/conversations/{conversation_id}/messages")
async def get_conversation_messages(
    conversation_id: str,
    filter_type: str = Query("all"),
    limit: int = Query(60, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv = await _get_conv_for_tenant(conversation_id, db, current_user)
    conv_id = conv.id

    q = (
        select(Message, Participant)
        .join(Participant, Message.participant_id == Participant.id)
        .where(Message.conversation_id == conv_id)
    )

    if filter_type == "followup":
        q = q.where(Message.is_followup_needed == True)  # noqa
    elif filter_type == "churn":
        q = q.where(Message.is_churn_risk == True)  # noqa
    elif filter_type == "opportunity":
        q = q.where(Message.is_opportunity == True)  # noqa
    elif filter_type == "alert":
        q = q.where(exists().where(AlertEvent.message_id == Message.id))

    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    q = q.order_by(Message.sent_at.asc()).offset(offset).limit(limit)
    rows = (await db.execute(q)).fetchall()

    msg_ids = [msg.id for msg, _ in rows]
    alert_map: dict[str, list] = {}
    if msg_ids:
        alert_rows = await db.execute(
            select(AlertEvent)
            .where(AlertEvent.message_id.in_(msg_ids))
            .order_by(AlertEvent.triggered_at.asc())
        )
        for alert in alert_rows.scalars():
            key = str(alert.message_id)
            alert_map.setdefault(key, []).append({
                "id": str(alert.id),
                "alert_type": alert.alert_type,
                "severity": alert.severity,
                "title": alert.title,
                "status": alert.status,
            })

    type_icons = {"text": "💬", "audio": "🎤", "image": "🖼️",
                  "document": "📄", "video": "📹", "sticker": "😊"}

    messages = []
    for msg, part in rows:
        signals = []
        if msg.is_followup_needed: signals.append("followup")
        if msg.is_churn_risk: signals.append("churn")
        if msg.is_opportunity: signals.append("opportunity")

        messages.append({
            "id": str(msg.id),
            "content": msg.content or "",
            "message_type": msg.message_type,
            "type_icon": type_icons.get(msg.message_type, "💬"),
            "sender": _part_display(part),
            "sender_id": str(part.id),
            "is_internal": bool(part.is_internal) if part else False,
            "sent_at": msg.sent_at.isoformat() if msg.sent_at else None,
            "risk_score": msg.risk_score,
            "signals": signals,
            "tags": msg.tags or [],
            "alerts": alert_map.get(str(msg.id), []),
        })

    return {
        "conversation": {"id": str(conv.id), "name": _conv_display(conv),
                         "original_name": conv.name, "custom_name": conv.custom_name},
        "messages": messages,
        "total": total,
        "offset": offset,
        "limit": limit,
    }


@router.get("/analytics/tags")
async def get_tag_analytics(
    days: int = Query(30, le=90),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    tid = str(current_user.id)

    tag_counts_raw = await db.execute(text("""
        SELECT tag, COUNT(*) as cnt
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id,
             jsonb_array_elements_text(m.tags) as tag
        WHERE m.sent_at >= :since
          AND c.tenant_id = CAST(:tid AS uuid)
          AND jsonb_array_length(m.tags) > 0
        GROUP BY tag
        ORDER BY cnt DESC
    """), {"since": since, "tid": tid})
    tag_counts = [{"tag": r[0], "count": r[1]} for r in tag_counts_raw.fetchall()]
    total_messages = sum(t["count"] for t in tag_counts)

    tag_by_group_raw = await db.execute(text("""
        SELECT tag, c.name, COALESCE(c.custom_name, c.name) as display_name,
               c.id::text as conv_id, COUNT(*) as cnt
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id,
             jsonb_array_elements_text(m.tags) as tag
        WHERE m.sent_at >= :since
          AND c.tenant_id = CAST(:tid AS uuid)
          AND jsonb_array_length(m.tags) > 0
        GROUP BY tag, c.id, c.name, c.custom_name
        ORDER BY tag, cnt DESC
    """), {"since": since, "tid": tid})

    group_map: dict[str, list] = {}
    for row in tag_by_group_raw.fetchall():
        tag, name, display, conv_id, cnt = row
        group_map.setdefault(tag, []).append({"conv_id": conv_id, "name": display, "count": cnt})

    daily_raw = await db.execute(text("""
        SELECT DATE(m.sent_at AT TIME ZONE 'UTC') as day, tag, COUNT(*) as cnt
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id,
             jsonb_array_elements_text(m.tags) as tag
        WHERE m.sent_at >= :since
          AND c.tenant_id = CAST(:tid AS uuid)
          AND jsonb_array_length(m.tags) > 0
        GROUP BY day, tag
        ORDER BY day, tag
    """), {"since": since, "tid": tid})

    daily_map: dict[str, dict[str, int]] = {}
    for row in daily_raw.fetchall():
        day, tag, cnt = str(row[0]), row[1], row[2]
        daily_map.setdefault(day, {})[tag] = cnt

    all_tags = [t["tag"] for t in tag_counts]
    daily_series = []
    for day_str in sorted(daily_map.keys()):
        entry = {"date": day_str}
        for tag in all_tags:
            entry[tag] = daily_map[day_str].get(tag, 0)
        daily_series.append(entry)

    return {
        "days": days,
        "total_tagged_occurrences": total_messages,
        "tags": [{**t, "groups": group_map.get(t["tag"], [])[:5]} for t in tag_counts],
        "daily_series": daily_series,
    }


@router.get("/analytics/tags/{tag}/messages")
async def get_tag_messages(
    tag: str,
    limit: int = Query(40, le=100),
    offset: int = Query(0, ge=0),
    days: int = Query(30, le=90),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    tag_json = f'["{tag}"]'
    tid = str(current_user.id)

    count_raw = await db.execute(text("""
        SELECT COUNT(*) FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        WHERE m.sent_at >= :since
          AND c.tenant_id = CAST(:tid AS uuid)
          AND m.tags @> CAST(:tag_json AS jsonb)
    """), {"since": since, "tid": tid, "tag_json": tag_json})
    total = count_raw.scalar() or 0

    rows = await db.execute(text("""
        SELECT m.id::text, m.content, m.message_type, m.sent_at,
               m.risk_score, m.tags,
               COALESCE(p.custom_name, p.name) as sender,
               COALESCE(c.custom_name, c.name) as group_name,
               c.id::text as conv_id
        FROM messages m
        JOIN participants p ON m.participant_id = p.id
        JOIN conversations c ON m.conversation_id = c.id
        WHERE m.sent_at >= :since
          AND c.tenant_id = CAST(:tid AS uuid)
          AND m.tags @> CAST(:tag_json AS jsonb)
        ORDER BY m.sent_at DESC
        LIMIT :limit OFFSET :offset
    """), {"since": since, "tid": tid, "tag_json": tag_json, "limit": limit, "offset": offset})

    type_icons = {"text": "💬", "audio": "🎤", "image": "🖼️",
                  "document": "📄", "video": "📹", "sticker": "😊"}
    messages = []
    for row in rows.fetchall():
        msg_id, content, mtype, sent_at, risk, tags, sender, group_name, conv_id = row
        messages.append({
            "id": msg_id, "content": content or "", "message_type": mtype,
            "type_icon": type_icons.get(mtype, "💬"), "sender": sender,
            "group_name": group_name, "conv_id": conv_id,
            "sent_at": sent_at.isoformat() if sent_at else None,
            "risk_score": risk, "tags": tags or [],
        })

    return {"tag": tag, "total": total, "messages": messages}


@router.get("/conversations/{conversation_id}/profile")
async def get_conversation_profile(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv = await _get_conv_for_tenant(conversation_id, db, current_user)
    conv_id = conv.id

    part_rows = await db.execute(text("""
        SELECT DISTINCT ON (p.id)
            p.id::text, p.name, p.custom_name, p.role, p.is_internal,
            p.external_id, p.email,
            COUNT(m.id) OVER (PARTITION BY p.id) as message_count,
            MAX(m.sent_at) OVER (PARTITION BY p.id) as last_seen,
            (SELECT COUNT(DISTINCT m2.conversation_id) FROM messages m2 WHERE m2.participant_id = p.id) as group_count
        FROM participants p
        JOIN messages m ON m.participant_id = p.id
        WHERE m.conversation_id = :conv_id
        ORDER BY p.id, m.sent_at DESC
    """), {"conv_id": str(conv_id)})

    participants = []
    for r in part_rows.fetchall():
        pid, name, cname, role, is_int, ext_id, email, msg_cnt, last_seen, grp_cnt = r
        participants.append({
            "id": pid, "name": cname or name, "original_name": name, "custom_name": cname,
            "role": role, "is_internal": is_int, "external_id": ext_id or "",
            "email": email or "", "message_count": int(msg_cnt or 0),
            "last_seen": last_seen.isoformat() if last_seen else None,
            "group_count": int(grp_cnt or 0),
        })

    extra = conv.extra_data or {}
    return {
        "id": str(conv.id), "name": _conv_display(conv), "original_name": conv.name,
        "custom_name": conv.custom_name,
        "group_type": getattr(conv, "group_type", None) or extra.get("group_type"),
        "description": conv.description or "", "ai_context": extra.get("ai_context", ""),
        "website": extra.get("website", ""), "social": extra.get("social", {}),
        "documents": extra.get("documents", []), "gpt_brain_url": extra.get("gpt_brain_url", ""),
        "contract_scope": extra.get("contract_scope", ""),
        "contract_value": extra.get("contract_value", ""),
        "contract_start": extra.get("contract_start", ""),
        "is_active": conv.is_active, "participants": participants,
    }


@router.patch("/conversations/{conversation_id}")
async def update_conversation(
    conversation_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv = await _get_conv_for_tenant(conversation_id, db, current_user)

    if "custom_name" in body:
        conv.custom_name = body["custom_name"] or None

    extra_keys = ["ai_context", "website", "social", "documents",
                  "gpt_brain_url", "contract_scope", "contract_value", "contract_start"]
    extra = dict(conv.extra_data or {})
    changed_extra = False
    for key in extra_keys:
        if key in body:
            if body[key] in (None, "", {}, []):
                extra.pop(key, None)
            else:
                extra[key] = body[key]
            changed_extra = True

    if "group_type" in body:
        extra["group_type"] = body["group_type"] or None
        changed_extra = True

    if "description" in body:
        conv.description = body["description"] or None

    if changed_extra:
        conv.extra_data = extra

    await db.commit()
    return {"id": str(conv.id), "custom_name": conv.custom_name,
            "name": conv.name, "group_type": extra.get("group_type")}


@router.patch("/participants/{participant_id}")
async def update_participant(
    participant_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import uuid as _uuid
    part_id = _uuid.UUID(participant_id)
    result = await db.execute(select(Participant).where(Participant.id == part_id))
    part = result.scalar_one_or_none()
    if not part:
        raise HTTPException(404, "Participante não encontrado")

    if "custom_name" in body:
        part.custom_name = body["custom_name"] or None
    if "role" in body:
        from app.models.participant import ParticipantRole
        try:
            part.role = ParticipantRole(body["role"])
        except ValueError:
            pass
    if "is_internal" in body:
        part.is_internal = bool(body["is_internal"])
    await db.commit()
    return {"id": str(part.id), "custom_name": part.custom_name,
            "name": part.name, "role": part.role, "is_internal": part.is_internal}
