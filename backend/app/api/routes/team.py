"""Rotas de gestão de colaboradores e métricas do time."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text

from app.db.session import get_db
from app.models.participant import Participant
from app.models.message import Message
from app.models.conversation import Conversation
from app.models.user import User
from app.api.deps import get_current_user
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter()


@router.get("/team/members")
async def list_team_members(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista todos os colaboradores internos com stats: grupos, msgs, tempo de resposta."""

    # IDs das conversas monitoradas do tenant
    conv_result = await db.execute(
        select(Conversation.id, Conversation.name).where(
            Conversation.tenant_id == current_user.id,
            Conversation.is_monitored == True,  # noqa
        )
    )
    convs = {str(r.id): r.name for r in conv_result.all()}
    if not convs:
        return []

    conv_ids_sql = ", ".join("'" + cid + "'" for cid in convs)

    # Participantes internos com contagem de mensagens e grupos
    raw = await db.execute(text(f"""
        SELECT
            p.id::text,
            COALESCE(p.custom_name, p.name) AS display_name,
            p.name,
            p.custom_name,
            p.role,
            p.external_id,
            p.is_internal,
            COUNT(DISTINCT m.id)             AS message_count,
            COUNT(DISTINCT m.conversation_id) AS group_count,
            MAX(m.sent_at)                   AS last_message_at,
            ARRAY_AGG(DISTINCT c.name)        AS group_names
        FROM participants p
        JOIN messages m ON m.participant_id = p.id
        JOIN conversations c ON c.id = m.conversation_id
        WHERE p.is_internal = TRUE
          AND m.conversation_id IN ({conv_ids_sql})
        GROUP BY p.id
        ORDER BY message_count DESC
    """))
    members = []
    for r in raw.mappings():
        members.append({
            "id": r["id"],
            "display_name": r["display_name"],
            "name": r["name"],
            "custom_name": r["custom_name"],
            "role": r["role"],
            "external_id": r["external_id"],
            "message_count": r["message_count"],
            "group_count": r["group_count"],
            "last_message_at": r["last_message_at"].isoformat() if r["last_message_at"] else None,
            "groups": [g for g in (r["group_names"] or []) if g],
        })

    if not members:
        return members

    # Tempo médio de resposta por colaborador (via SQL)
    member_ids_sql = ", ".join("'" + m["id"] + "'" for m in members)
    rt_raw = await db.execute(text(f"""
        WITH ext AS (
            SELECT m.conversation_id, m.sent_at,
                   LEAD(m.sent_at)          OVER w AS next_sent_at,
                   LEAD(m.participant_id)   OVER w AS next_participant_id,
                   LEAD(p2.is_internal)     OVER w AS next_is_internal
            FROM messages m
            LEFT JOIN participants p2 ON p2.id = m.participant_id
            LEFT JOIN participants p1 ON p1.id = m.participant_id
            WHERE m.conversation_id IN ({conv_ids_sql})
              AND (p1.is_internal = FALSE OR p1.id IS NULL)
            WINDOW w AS (PARTITION BY m.conversation_id ORDER BY m.sent_at)
        )
        SELECT
            ext.next_participant_id::text AS participant_id,
            AVG(EXTRACT(EPOCH FROM (ext.next_sent_at - ext.sent_at)) / 60.0) AS avg_minutes,
            COUNT(*) AS response_count
        FROM ext
        WHERE ext.next_is_internal = TRUE
          AND ext.next_participant_id IS NOT NULL
          AND ext.next_participant_id::text IN ({member_ids_sql})
          AND ext.next_sent_at > ext.sent_at
          AND EXTRACT(EPOCH FROM (ext.next_sent_at - ext.sent_at)) / 60.0 BETWEEN 0.1 AND 480
        GROUP BY ext.next_participant_id
    """))
    rt_map = {r["participant_id"]: {"avg_minutes": float(r["avg_minutes"]), "response_count": int(r["response_count"])} for r in rt_raw.mappings()}

    for m in members:
        rt = rt_map.get(m["id"])
        m["avg_response_minutes"] = round(rt["avg_minutes"], 1) if rt else None
        m["response_count"] = rt["response_count"] if rt else 0

    return members


@router.get("/team/candidates")
async def list_team_candidates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Participantes não-internos que aparecem nos grupos — para recrutamento de colaboradores."""
    conv_result = await db.execute(
        select(Conversation.id).where(
            Conversation.tenant_id == current_user.id,
            Conversation.is_monitored == True,  # noqa
        )
    )
    conv_ids = [str(r.id) for r in conv_result.all()]
    if not conv_ids:
        return []

    conv_ids_sql = ", ".join("'" + cid + "'" for cid in conv_ids)
    raw = await db.execute(text(f"""
        SELECT
            p.id::text,
            COALESCE(p.custom_name, p.name) AS display_name,
            p.name, p.custom_name, p.role, p.external_id, p.is_internal,
            COUNT(DISTINCT m.id)             AS message_count,
            COUNT(DISTINCT m.conversation_id) AS group_count,
            ARRAY_AGG(DISTINCT c.name)        AS group_names
        FROM participants p
        JOIN messages m ON m.participant_id = p.id
        JOIN conversations c ON c.id = m.conversation_id
        WHERE p.is_internal = FALSE
          AND m.conversation_id IN ({conv_ids_sql})
        GROUP BY p.id
        HAVING COUNT(DISTINCT m.id) >= 3
        ORDER BY message_count DESC
        LIMIT 100
    """))
    return [dict(r) for r in raw.mappings()]


@router.patch("/team/members/{participant_id}")
async def toggle_team_member(
    participant_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Marca ou desmarca um participante como colaborador interno."""
    import uuid as uuid_mod
    try:
        pid = uuid_mod.UUID(participant_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID inválido")

    part = await db.get(Participant, pid)
    if not part:
        raise HTTPException(status_code=404, detail="Participante não encontrado")

    if "is_internal" in body:
        part.is_internal = bool(body["is_internal"])
    if "role" in body:
        part.role = body["role"]
    if "custom_name" in body:
        part.custom_name = body["custom_name"] or None

    await db.commit()
    return {
        "id": str(part.id),
        "is_internal": part.is_internal,
        "role": part.role,
        "display_name": part.custom_name or part.name,
    }
