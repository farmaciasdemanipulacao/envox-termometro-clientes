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


@router.get("/conversations/{conversation_id}/range-summary")
async def get_conversation_range_summary(
    conversation_id: str,
    start_date: str = Query(..., description="ISO date: 2026-06-01"),
    end_date: str = Query(..., description="ISO date: 2026-06-27"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Gera resumo analítico de uma conversa para um período customizado.
    Retorna estatísticas, distribuição de tags, temperatura e texto executivo.
    """
    conv = await _get_conv_for_tenant(conversation_id, db, current_user)

    try:
        start_dt = datetime.fromisoformat(start_date).replace(tzinfo=timezone.utc)
        end_dt = datetime.fromisoformat(end_date).replace(tzinfo=timezone.utc) + timedelta(days=1) - timedelta(seconds=1)
    except ValueError:
        raise HTTPException(400, "Datas inválidas. Use o formato YYYY-MM-DD.")

    if (end_dt - start_dt).days > 366:
        raise HTTPException(400, "Período máximo: 366 dias.")

    conv_id = conv.id

    # ── Mensagens no período ─────────────────────────────────────
    msg_result = await db.execute(
        select(Message).where(
            and_(
                Message.conversation_id == conv_id,
                Message.sent_at >= start_dt,
                Message.sent_at <= end_dt,
            )
        ).order_by(Message.sent_at)
    )
    messages = msg_result.scalars().all()
    total_messages = len(messages)

    # ── Nomes dos participantes ───────────────────────────────────
    participant_ids = list({m.participant_id for m in messages if m.participant_id})
    participant_names: dict = {}
    if participant_ids:
        part_result = await db.execute(
            select(Participant).where(Participant.id.in_(participant_ids))
        )
        for p in part_result.scalars().all():
            participant_names[p.id] = p.custom_name or p.name or str(p.id)[:8]

    # ── Transcrição amostrada ─────────────────────────────────────
    def _msg_to_line(m) -> str:
        ts = m.sent_at.strftime("%d/%m %H:%M") if m.sent_at else "??"
        author = participant_names.get(m.participant_id, "Desconhecido")
        content = (m.content or "").strip()[:300]
        return f"[{ts}] {author}: {content}"

    if total_messages == 0:
        return {
            "conversation": {"id": str(conv.id), "name": _conv_display(conv)},
            "period": {"start": start_date, "end": end_date},
            "stats": {"total_messages": 0},
            "executive_text": "Nenhuma mensagem encontrada no período selecionado.",
            "temperature_score": 0,
            "temperature_label": "neutro",
            "top_messages": [],
            "tag_distribution": {},
        }

    # ── Estatísticas ─────────────────────────────────────────────
    unique_participants = len({m.participant_id for m in messages if m.participant_id})
    avg_risk = sum(m.risk_score or 0 for m in messages) / total_messages
    avg_sentiment = sum(m.sentiment_score or 0.0 for m in messages) / total_messages

    churn_count = sum(1 for m in messages if m.is_churn_risk)
    escalation_count = sum(1 for m in messages if m.is_escalation)
    opportunity_count = sum(1 for m in messages if m.is_opportunity)
    complaint_count = sum(1 for m in messages if m.is_complaint)
    followup_count = sum(1 for m in messages if m.is_followup_needed)

    # Distribuição de tags
    tag_dist: dict = {}
    for m in messages:
        for tag in (m.tags or []):
            tag_dist[tag] = tag_dist.get(tag, 0) + 1

    # Alertas no período
    alert_result = await db.execute(
        select(AlertEvent).where(
            and_(
                AlertEvent.conversation_id == conv_id,
                AlertEvent.triggered_at >= start_dt,
                AlertEvent.triggered_at <= end_dt,
            )
        )
    )
    alerts = alert_result.scalars().all()
    critical_alerts = sum(1 for a in alerts if a.severity == AlertSeverity.CRITICAL)

    # ── Temperatura ───────────────────────────────────────────────
    risk_norm = min(avg_risk / 100, 1.0)
    churn_norm = min(churn_count / max(total_messages, 1) * 10, 1.0)
    sentiment_neg = max(-avg_sentiment, 0)
    temperature_score = int((risk_norm * 0.5 + churn_norm * 0.3 + sentiment_neg * 0.2) * 100)
    temperature_score = max(0, min(100, temperature_score))

    if temperature_score >= 70:
        temperature_label = "critico"
    elif temperature_score >= 40:
        temperature_label = "alerta"
    elif temperature_score >= 20:
        temperature_label = "moderado"
    else:
        temperature_label = "saudavel"

    # ── Mensagens de destaque (maior risco) ───────────────────────
    top = sorted(messages, key=lambda m: (m.risk_score or 0), reverse=True)[:5]

    # ── Transcrição amostrada para LLM ────────────────────────────
    # Estratégia: primeiras 25 + últimas 25 + top-25 por risco (sem duplicatas, até 60 total)
    if total_messages <= 80:
        sample = messages
    else:
        first25 = messages[:25]
        last25 = messages[-25:]
        by_risk = sorted(messages, key=lambda m: (m.risk_score or 0), reverse=True)[:25]
        seen_ids = set()
        sample = []
        for m in first25 + by_risk + last25:
            if m.id not in seen_ids:
                seen_ids.add(m.id)
                sample.append(m)
        sample.sort(key=lambda m: m.sent_at or datetime.min.replace(tzinfo=timezone.utc))

    transcript_lines = [_msg_to_line(m) for m in sample]

    # ── Texto executivo ───────────────────────────────────────────
    from app.services.agent import get_agent_config, inject_agent_identity
    agent_cfg = await get_agent_config(db, current_user.id)

    executive_text = await _generate_range_text(
        conv_name=_conv_display(conv),
        start_date=start_date,
        end_date=end_date,
        total_messages=total_messages,
        unique_participants=unique_participants,
        avg_risk=avg_risk,
        churn_count=churn_count,
        escalation_count=escalation_count,
        opportunity_count=opportunity_count,
        complaint_count=complaint_count,
        followup_count=followup_count,
        critical_alerts=critical_alerts,
        tag_dist=tag_dist,
        temperature_score=temperature_score,
        top_messages=top,
        transcript_lines=transcript_lines,
        db=db,
        agent_config=agent_cfg,
    )
    executive_text = inject_agent_identity(executive_text, agent_cfg, temperature_label)

    return {
        "conversation": {"id": str(conv.id), "name": _conv_display(conv)},
        "period": {"start": start_date, "end": end_date},
        "stats": {
            "total_messages": total_messages,
            "unique_participants": unique_participants,
            "avg_risk_score": round(avg_risk, 1),
            "avg_sentiment_score": round(avg_sentiment, 3),
            "churn_risk_count": churn_count,
            "escalation_count": escalation_count,
            "opportunity_count": opportunity_count,
            "complaint_count": complaint_count,
            "followup_count": followup_count,
            "critical_alerts": critical_alerts,
            "total_alerts": len(alerts),
        },
        "tag_distribution": dict(sorted(tag_dist.items(), key=lambda x: -x[1])[:12]),
        "executive_text": executive_text,
        "temperature_score": temperature_score,
        "temperature_label": temperature_label,
        "top_messages": [
            {
                "id": str(m.id),
                "content": m.content[:300] if m.content else "",
                "sent_at": m.sent_at.isoformat() if m.sent_at else None,
                "risk_score": m.risk_score,
                "tags": m.tags or [],
            }
            for m in top
        ],
    }


@router.get("/conversations")
async def list_conversations(
    search: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista conversas do tenant para selecionar no range-summary."""
    query = select(Conversation).where(
        and_(Conversation.tenant_id == current_user.id, Conversation.is_active == True)  # noqa
    ).order_by(Conversation.name)

    if search:
        ilike = f"%{search}%"
        query = query.where(
            (Conversation.name.ilike(ilike)) | (Conversation.custom_name.ilike(ilike))
        )

    query = query.limit(limit)
    result = await db.execute(query)
    convs = result.scalars().all()
    return [{"id": str(c.id), "name": _conv_display(c)} for c in convs]


async def _generate_range_text(
    conv_name, start_date, end_date, total_messages, unique_participants,
    avg_risk, churn_count, escalation_count, opportunity_count, complaint_count,
    followup_count, critical_alerts, tag_dist, temperature_score, top_messages,
    transcript_lines, db, agent_config=None,
) -> str:
    """Gera texto executivo para o período — usa Claude se LLM_ENABLED, heurístico como fallback."""
    from app.core.config import settings

    if settings.LLM_ENABLED and settings.ANTHROPIC_API_KEY:
        try:
            return await _range_text_claude(
                conv_name, start_date, end_date, total_messages, unique_participants,
                avg_risk, churn_count, escalation_count, opportunity_count, complaint_count,
                followup_count, critical_alerts, tag_dist, top_messages, transcript_lines,
                agent_config=agent_config,
            )
        except Exception:
            pass

    return _range_text_heuristic(
        conv_name, start_date, end_date, total_messages, unique_participants,
        avg_risk, churn_count, escalation_count, opportunity_count, complaint_count,
        followup_count, critical_alerts, tag_dist, temperature_score, top_messages,
    )


def _range_text_heuristic(
    conv_name, start_date, end_date, total_messages, unique_participants,
    avg_risk, churn_count, escalation_count, opportunity_count, complaint_count,
    followup_count, critical_alerts, tag_dist, temperature_score, top_messages=None,
) -> str:
    lines = []
    lines.append(
        f"**{conv_name}** — período de {start_date} a {end_date}: "
        f"{total_messages} mensagens de {unique_participants} participante(s)."
    )

    if churn_count > 0:
        lines.append(
            f"\n**Risco de Cancelamento:** {churn_count} sinal(is) de churn detectado(s). "
            "Atenção imediata recomendada."
        )
    if escalation_count > 0:
        lines.append(
            f"\n**Escaladas Emocionais:** {escalation_count} situação(ões) de tensão elevada identificada(s)."
        )
    if complaint_count > 0:
        lines.append(f"\n**Reclamações:** {complaint_count} mensagem(ns) com sinal de insatisfação.")
    if opportunity_count > 0:
        lines.append(f"\n**Oportunidades Comerciais:** {opportunity_count} sinal(is) de oportunidade detectado(s).")
    if followup_count > 0:
        lines.append(f"\n**Follow-ups Pendentes:** {followup_count} mensagem(ns) requerem retorno.")
    if critical_alerts > 0:
        lines.append(f"\n**Alertas Críticos:** {critical_alerts} alerta(s) crítico(s) gerado(s) no período.")

    if avg_risk >= 60:
        lines.append(f"\n**Score de Risco Médio:** {avg_risk:.0f}/100 — nível elevado.")
    elif avg_risk >= 30:
        lines.append(f"\n**Score de Risco Médio:** {avg_risk:.0f}/100 — nível moderado.")
    else:
        lines.append(f"\n**Score de Risco Médio:** {avg_risk:.0f}/100 — nível baixo.")

    if tag_dist:
        top_tags = sorted(tag_dist.items(), key=lambda x: -x[1])[:3]
        tags_str = ", ".join(f"{t} ({n}x)" for t, n in top_tags)
        lines.append(f"\n**Temas Mais Frequentes:** {tags_str}.")

    if top_messages:
        notable = [m for m in top_messages if m.content and (m.risk_score or 0) >= 30][:3]
        if notable:
            lines.append("\n**Mensagens de Destaque:**")
            for m in notable:
                ts = m.sent_at.strftime("%d/%m") if m.sent_at else ""
                snippet = (m.content or "").strip()[:200]
                tags_str = ", ".join(m.tags or [])
                lines.append(f"> [{ts}] {snippet}" + (f" _({tags_str})_" if tags_str else ""))

    if temperature_score >= 70:
        lines.append("\n> Operação em **estado crítico** no período. Revisão prioritária necessária.")
    elif temperature_score >= 40:
        lines.append("\n> Operação em **estado de alerta**. Monitoramento reforçado recomendado.")
    else:
        lines.append("\n> Operação dentro do **padrão saudável** no período.")

    return "\n".join(lines)


async def _range_text_claude(
    conv_name, start_date, end_date, total_messages, unique_participants,
    avg_risk, churn_count, escalation_count, opportunity_count, complaint_count,
    followup_count, critical_alerts, tag_dist, top_messages, transcript_lines,
    agent_config=None,
) -> str:
    import anthropic
    from app.core.config import settings
    from app.services.agent import build_agent_personality_prompt

    agent_intro = build_agent_personality_prompt(agent_config) if agent_config else \
        "Você é um analista de relacionamento e CRM."

    transcript_block = "\n".join(transcript_lines) if transcript_lines else "Sem mensagens disponíveis."

    top_tags_str = ", ".join(
        f"{t}({n}x)" for t, n in sorted(tag_dist.items(), key=lambda x: -x[1])[:6]
    ) if tag_dist else "nenhuma"

    stats_block = (
        f"- Mensagens analisadas: {total_messages} (de {unique_participants} participante(s))\n"
        f"- Risco médio: {avg_risk:.1f}/100 | Churn: {churn_count} | Escaladas: {escalation_count}\n"
        f"- Oportunidades: {opportunity_count} | Reclamações: {complaint_count} | Follow-ups: {followup_count}\n"
        f"- Alertas críticos: {critical_alerts} | Tags: {top_tags_str}"
    )

    prompt = f"""{agent_intro}

Analise a conversa do grupo **{conv_name}** no período de {start_date} a {end_date} e produza um resumo executivo em markdown (4-6 parágrafos).

**Estatísticas do período:**
{stats_block}

**Transcrição das mensagens ({len(transcript_lines)} de {total_messages}):**
{transcript_block}

**Instruções:**
- Foque no CONTEÚDO: o que foi discutido, problemas levantados, decisões tomadas, temas recorrentes
- Identifique o tom geral da conversa (colaborativo, tenso, neutro, etc.)
- Destaque pontos de ação concretos para o gestor
- Se houver sinais de insatisfação, churn ou urgência, cite o contexto exato
- Use **negrito** para pontos críticos; não use listas longas — prefira parágrafos fluídos
- Responda em português brasileiro"""

    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    resp = await client.messages.create(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=800,
        messages=[{"role": "user", "content": prompt}],
    )
    return resp.content[0].text


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
