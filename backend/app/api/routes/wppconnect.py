"""
Webhook do WppConnect Server — recebe eventos e roteia para o tenant correto.
URL: POST /api/v1/webhooks/wppconnect
"""
import re
from fastapi import APIRouter, Request, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, distinct
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.config import settings
from app.db.session import AsyncSessionLocal, get_db
from app.models.source import IngestionSource, SourceType
from app.models.tenant import TenantConfig
from app.models.conversation import Conversation, ConversationType
from app.models.participant import Participant
from app.models.message import Message
from app.api.deps import get_current_user
from app.models.user import User
from app.models.subscription import Subscription
from app.models.plan import Plan
from app.connectors.wppconnect_server import wpp_client, get_client_for_session
from app.services.ingestion.processor import IngestionProcessor
from app.services.ingestion.wpp_normalizer import normalize_wpp_payload

router = APIRouter()
logger = get_logger(__name__)
processor = IngestionProcessor()


def _is_name_like(s: str) -> bool:
    """True se a string parece um nome humano (não é número de telefone nem ID)."""
    if not s:
        return False
    clean = re.sub(r"[\s\-\+\(\)\.]", "", s)
    if clean.isdigit():
        return False
    if "@" in s:
        return False
    if len(s) < 2:
        return False
    # Se começa com muitos dígitos sem letras → provavelmente número
    if re.match(r"^\d{5,}", clean):
        return False
    return True


def _participant_display(p: dict) -> str:
    """Extrai o nome ou número de um participante bruto do WppConnect."""
    name = p.get("notifyName") or p.get("pushname") or p.get("name") or ""
    if _is_name_like(name):
        return name.strip()
    pid = p.get("id", {})
    if isinstance(pid, dict):
        user = pid.get("user", "")
        serialized = pid.get("_serialized", "")
    elif isinstance(pid, str):
        user = pid.split("@")[0]
        serialized = pid
    else:
        user = ""
        serialized = str(pid)
    if user and re.match(r"^\d+$", user):
        return f"+{user}"
    if serialized and "@c.us" in serialized:
        num = serialized.split("@")[0]
        if re.match(r"^\d+$", num):
            return f"+{num}"
    return (name or user or serialized or "").strip() or "Desconhecido"


async def _get_source_for_session(db, session_name: str) -> IngestionSource | None:
    """Localiza o IngestionSource do tenant dono daquela sessão WppConnect."""
    tc_result = await db.execute(
        select(TenantConfig).where(TenantConfig.wpp_session == session_name)
    )
    tc = tc_result.scalar_one_or_none()
    if not tc:
        return None

    src_result = await db.execute(
        select(IngestionSource).where(
            IngestionSource.tenant_id == tc.tenant_id,
            IngestionSource.source_type == SourceType.WEBHOOK,
            IngestionSource.is_active == True,  # noqa
        )
    )
    return src_result.scalar_one_or_none()


async def _get_or_create_fallback_source(db) -> IngestionSource:
    """Source fallback — usado quando o session_name não bate com nenhum tenant."""
    result = await db.execute(
        select(IngestionSource).where(IngestionSource.name == "WppConnect Monitor")
    )
    source = result.scalar_one_or_none()
    if not source:
        source = IngestionSource(
            name="WppConnect Monitor",
            description="Ingestão automática via WppConnect (fallback)",
            source_type=SourceType.WEBHOOK,
            # Sem api_key_hash — nunca resolvida por X-API-Key, só por nome/tenant_id.
            # Reaproveitar API_KEY_SECRET aqui causava colisão com "Development Default" (D-027).
            api_key_hash=None,
            is_active=True,
        )
        db.add(source)
        await db.flush()
    return source


@router.get("/wpp/status")
async def get_wpp_status():
    """Status da sessão padrão (admin). Sem auth — compatibilidade com versão anterior."""
    try:
        token = await wpp_client.generate_token()
        status = await wpp_client.get_status(token)
        current = status.get("status", "UNKNOWN")
        phone = status.get("phoneNumber") or status.get("pushname") or ""
        return {
            "connected": current in ("CONNECTED", "isLogged"),
            "status": current,
            "phone": phone,
        }
    except Exception as e:
        return {"connected": False, "status": "ERROR", "phone": "", "error": str(e)}


class GroupToggleRequest(BaseModel):
    wpp_id: str       # e.g. "120363425237161270@g.us"
    name: str
    participant_count: int = 0
    enable: bool = True
    days_back: int | None = 90  # None = sem corte (desde o começo); 0 = sem backfill


@router.get("/wpp/available-groups")
async def get_available_groups(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lista todos os grupos WhatsApp disponíveis no WppConnect do tenant.
    Retorna lista vazia se o tenant não tem WppConnect configurado.
    """
    tc_result = await db.execute(
        select(TenantConfig).where(TenantConfig.tenant_id == current_user.id)
    )
    tenant_cfg = tc_result.scalar_one_or_none()
    if not tenant_cfg:
        return []

    client = get_client_for_session(tenant_cfg.wpp_url, tenant_cfg.wpp_session, tenant_cfg.wpp_secret)
    try:
        token = await client.generate_token()
        wpp_groups = await client.get_all_groups(token)
    except Exception as e:
        logger.warning("wpp_list_groups_failed", session=tenant_cfg.wpp_session, error=str(e))
        return []  # sessão ainda não iniciada ou desconectada — retorna vazio

    # Busca conversas monitoradas do tenant
    result = await db.execute(
        select(Conversation).where(Conversation.tenant_id == current_user.id)
    )
    conv_map: dict[str, Conversation] = {}
    for c in result.scalars().all():
        key = c.wpp_group_id or c.external_id or ""
        if key:
            conv_map[key] = c

    out = []
    for g in wpp_groups:
        wpp_id = g["wpp_id"]
        conv = conv_map.get(wpp_id)

        # Participantes — do banco (grupos monitorados) ou do WppConnect (não monitorados)
        participants_display: list[str] = []
        if conv:
            pid_result = await db.execute(
                select(Message.participant_id)
                .where(
                    Message.conversation_id == conv.id,
                    Message.participant_id.isnot(None),
                )
                .distinct()
                .limit(15)
            )
            pids = [row[0] for row in pid_result.all()]
            _db_skip = {"unknown", "desconhecido", ""}
            if pids:
                part_result = await db.execute(
                    select(Participant).where(Participant.id.in_(pids))
                )
                for p in part_result.scalars().all():
                    display = p.custom_name or p.name or ""
                    # Se nome é placeholder ou não parece nome, tenta extrair número
                    if display.lower() in _db_skip or not _is_name_like(display):
                        ext = p.external_id or ""
                        num = ext.split("@")[0]
                        display = f"+{num}" if (num and re.match(r"^\d+$", num)) else ""
                    if display:
                        participants_display.append(display.strip())
        else:
            _skip = {"desconhecido", "unknown", ""}
            for raw_p in (g.get("participants_raw") or [])[:15]:
                d = _participant_display(raw_p)
                if d and d.lower() not in _skip:
                    participants_display.append(d)

        out.append({
            "wpp_id": wpp_id,
            "name": g["name"],
            "participant_count": g["participant_count"],
            "last_message_ts": g["last_message_ts"],
            "is_monitored": conv is not None and conv.is_active,
            "conversation_id": str(conv.id) if conv else None,
            "custom_name": conv.custom_name if conv else None,
            "participants": participants_display,
        })

    # Ordena: monitorados primeiro, depois por número de participantes
    out.sort(key=lambda x: (not x["is_monitored"], -x["participant_count"]))
    return out


def _normalize_history_message(msg: dict, group_id: str, group_name: str) -> dict | None:
    """Normaliza mensagem do histórico (get-messages) para o formato do processor."""
    from datetime import datetime, timezone
    from_me = msg.get("fromMe", False)
    id_obj = msg.get("id", {})
    if isinstance(id_obj, dict):
        from_me = from_me or id_obj.get("fromMe", False)
    if from_me:
        return None

    sender_id = msg.get("author") or msg.get("from") or "unknown"
    sender_name = msg.get("notifyName") or msg.get("pushname") or sender_id.split("@")[0]

    body = msg.get("body") or ""
    wpp_type = msg.get("type", "chat")
    if wpp_type == "chat":
        content, msg_type = (body or "[Mensagem vazia]"), "text"
    elif wpp_type in ("image", "video", "audio", "ptt", "document"):
        content, msg_type = (body or f"[{wpp_type}]"), wpp_type
    else:
        content, msg_type = (body or f"[{wpp_type}]"), "text"

    ts = msg.get("t")
    if not ts:
        return None
    sent_at = datetime.fromtimestamp(int(ts), tz=timezone.utc).isoformat()

    if isinstance(id_obj, dict):
        external_id = id_obj.get("_serialized") or ""
    else:
        external_id = str(id_obj)

    return {
        "conversation_external_id": group_id,
        "conversation_name": group_name,
        "conversation_type": "group",
        "participant_external_id": sender_id,
        "participant_name": sender_name,
        "participant_role": "unknown",
        "content": content,
        "message_type": msg_type,
        "sent_at": sent_at,
        "external_id": external_id,
        "raw_payload": msg,
    }


async def _backfill_group_history(wpp_id: str, group_name: str, source_id: str, days_back: int | None = 90, tenant_id: str | None = None):
    """Busca e ingere mensagens históricas de um grupo em background.

    days_back=0 → sem backfill; days_back=None → sem corte de data (tudo disponível).
    Usa o WppConnect do tenant quando disponível; cai no global como fallback.
    """
    from datetime import datetime, timezone, timedelta
    from app.models.message import Message
    from app.models.source import IngestionSource
    import uuid

    if days_back == 0:
        logger.info("wpp_backfill_skipped", wpp_id=wpp_id, reason="days_back=0")
        return

    cutoff = (datetime.now(timezone.utc) - timedelta(days=days_back)) if days_back is not None else None

    # Resolve cliente WppConnect do tenant
    client = wpp_client
    if tenant_id:
        async with AsyncSessionLocal() as _db:
            tc_res = await _db.execute(
                select(TenantConfig).where(TenantConfig.tenant_id == uuid.UUID(tenant_id))
            )
            tc = tc_res.scalar_one_or_none()
            if tc:
                client = get_client_for_session(tc.wpp_url, tc.wpp_session, tc.wpp_secret)

    try:
        token = await client.generate_token()
        msgs = await client.fetch_messages_history(token, wpp_id, count=10000)
    except Exception as e:
        logger.error("wpp_backfill_fetch_failed", wpp_id=wpp_id, error=str(e))
        return

    logger.info("wpp_backfill_fetched", wpp_id=wpp_id, total=len(msgs))
    ingested = skipped_old = skipped_dup = skipped_invalid = 0

    async with AsyncSessionLocal() as db:
        try:
            src_result = await db.execute(
                select(IngestionSource).where(IngestionSource.id == uuid.UUID(source_id))
            )
            source = src_result.scalar_one_or_none()
            if not source:
                logger.error("wpp_backfill_source_not_found", source_id=source_id)
                return

            for raw_msg in msgs:
                normalized = _normalize_history_message(raw_msg, wpp_id, group_name)
                if not normalized:
                    skipped_invalid += 1
                    continue

                msg_ts = datetime.fromisoformat(normalized["sent_at"])
                if msg_ts.tzinfo is None:
                    from datetime import timezone as tz
                    msg_ts = msg_ts.replace(tzinfo=tz.utc)
                if cutoff is not None and msg_ts < cutoff:
                    skipped_old += 1
                    continue

                ext_id = normalized.get("external_id")
                if ext_id:
                    dup = await db.execute(
                        select(Message).where(Message.external_id == ext_id)
                    )
                    if dup.scalar_one_or_none():
                        skipped_dup += 1
                        continue

                try:
                    await processor.process_message(db, normalized, source)
                    ingested += 1
                    if ingested % 50 == 0:
                        await db.commit()
                except Exception as e:
                    logger.warning("wpp_backfill_msg_failed", error=str(e))
                    await db.rollback()
                    continue

            await db.commit()
            logger.info(
                "wpp_backfill_done",
                wpp_id=wpp_id,
                ingested=ingested,
                skipped_old=skipped_old,
                skipped_dup=skipped_dup,
                skipped_invalid=skipped_invalid,
            )
        except Exception as e:
            await db.rollback()
            logger.error("wpp_backfill_failed", wpp_id=wpp_id, error=str(e))
            return

    # Após backfill, dispara análise de participantes em nova sessão de DB
    if ingested > 0:
        await _profile_group_participants(wpp_id, group_name)


async def _profile_group_participants(wpp_id: str, group_name: str):
    """Analisa participantes do grupo após backfill — roda em background."""
    from app.services.participant_profiler import analyze_conversation_participants

    async with AsyncSessionLocal() as db:
        try:
            conv_result = await db.execute(
                select(Conversation).where(Conversation.wpp_group_id == wpp_id)
            )
            conv = conv_result.scalar_one_or_none()
            if not conv:
                return
            result = await analyze_conversation_participants(
                conversation_id=str(conv.id),
                db=db,
                group_name=group_name,
                force=False,
            )
            logger.info(
                "wpp_participant_profiling_done",
                wpp_id=wpp_id,
                analyzed=result.get("analyzed", 0),
                skipped=result.get("skipped", 0),
                errors=len(result.get("errors", [])),
            )
        except Exception as e:
            logger.error("wpp_participant_profiling_failed", wpp_id=wpp_id, error=str(e))


@router.post("/wpp/groups/toggle")
async def toggle_group_monitoring(
    payload: GroupToggleRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Ativa ou desativa o monitoramento de um grupo WppConnect.
    Ao ativar, pré-cria a Conversation para que as mensagens sejam vinculadas.
    """
    # Busca source WppConnect do tenant
    src_result = await db.execute(
        select(IngestionSource).where(
            IngestionSource.tenant_id == current_user.id,
            IngestionSource.source_type == SourceType.WEBHOOK,
            IngestionSource.is_active == True,  # noqa
        )
    )
    source = src_result.scalar_one_or_none()
    if not source:
        # Fallback: source padrão
        src_result2 = await db.execute(
            select(IngestionSource).where(IngestionSource.name == "WppConnect Monitor")
        )
        source = src_result2.scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=400, detail="Nenhuma source WppConnect configurada")

    # Procura conversa existente
    result = await db.execute(
        select(Conversation).where(
            Conversation.tenant_id == current_user.id,
            Conversation.wpp_group_id == payload.wpp_id,
        )
    )
    conv = result.scalar_one_or_none()

    # Também tenta pelo external_id para compatibilidade com conversas existentes
    if not conv:
        result2 = await db.execute(
            select(Conversation).where(
                Conversation.tenant_id == current_user.id,
                Conversation.external_id == payload.wpp_id,
            )
        )
        conv = result2.scalar_one_or_none()

    if payload.enable:
        # Busca plano do usuário (usado para max_groups e max_history_days)
        days_back = payload.days_back
        plan_max: int | None = 90  # default conservador para histórico
        sub_result = await db.execute(
            select(Subscription).where(Subscription.user_id == current_user.id)
        )
        sub = sub_result.scalar_one_or_none()
        plan = None
        if sub:
            plan = await db.get(Plan, sub.plan_id)
            if plan:
                plan_max = plan.max_history_days  # None = ilimitado

        # Valida limite de grupos do plano
        max_groups = plan.max_groups if plan else 5
        if max_groups != -1:
            monitored_count = await db.scalar(
                select(__import__("sqlalchemy").func.count(Conversation.id)).where(
                    Conversation.tenant_id == current_user.id,
                    Conversation.is_monitored == True,  # noqa
                    Conversation.wpp_group_id != payload.wpp_id,  # não conta o próprio grupo (reativação)
                )
            )
            if (monitored_count or 0) >= max_groups:
                raise HTTPException(
                    status_code=403,
                    detail=f"Limite do plano atingido: máximo de {max_groups} grupo{'s' if max_groups != 1 else ''} monitorado{'s' if max_groups != 1 else ''}. Faça upgrade para monitorar mais grupos.",
                )

        # Aplica limite: plan_max=None → sem restrição; plan_max=N → days_back ≤ N
        if plan_max is not None:
            if days_back is None or (days_back is not None and days_back > plan_max):
                days_back = plan_max

        if conv:
            conv.is_active = True
            conv.is_monitored = True
            conv.wpp_group_id = payload.wpp_id
            conv.participant_count = payload.participant_count
        else:
            conv = Conversation(
                tenant_id=current_user.id,
                source_id=source.id,
                external_id=payload.wpp_id,
                wpp_group_id=payload.wpp_id,
                name=payload.name,
                conversation_type=ConversationType.GROUP,
                is_active=True,
                is_monitored=True,
                participant_count=payload.participant_count,
                sla_response_minutes=settings.SLA_DEFAULT_MINUTES,
            )
            db.add(conv)
        await db.commit()
        await db.refresh(conv)
        background_tasks.add_task(_backfill_group_history, payload.wpp_id, payload.name, str(source.id), days_back, str(current_user.id))
        return {"status": "monitoring_enabled", "conversation_id": str(conv.id), "backfill": "started", "days_back": days_back}
    else:
        if conv:
            conv.is_active = False
            conv.is_monitored = False
            await db.commit()
        return {"status": "monitoring_disabled"}


@router.patch("/wpp/groups/{wpp_id}/name")
async def update_group_name(
    wpp_id: str,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Atualiza o nome personalizado de um grupo monitorado."""
    result = await db.execute(
        select(Conversation).where(
            Conversation.tenant_id == current_user.id,
            Conversation.wpp_group_id == wpp_id,
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        result2 = await db.execute(
            select(Conversation).where(
                Conversation.tenant_id == current_user.id,
                Conversation.external_id == wpp_id,
            )
        )
        conv = result2.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Grupo não encontrado")

    new_name = (payload.get("custom_name") or "").strip()
    conv.custom_name = new_name or None
    await db.commit()
    return {"status": "updated", "custom_name": conv.custom_name}


@router.post("/webhooks/wppconnect")
async def wppconnect_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Recebe eventos do WppConnect Server.
    Roteia para o tenant correto pelo campo 'session' do payload.
    """
    try:
        payload = await request.json()
    except Exception:
        logger.warning("wpp_webhook_invalid_json")
        return {"status": "ignored"}

    event = payload.get("event", "")
    data = payload.get("data") or payload
    session_name = payload.get("session") or settings.WPP_SESSION

    logger.debug("wpp_webhook_received", wpp_event=event, session=session_name)

    chat_id = str(data.get("chatId") or data.get("from") or "")
    is_group = data.get("isGroupMsg") or data.get("isGroup") or chat_id.endswith("@g.us")
    if event == "onmessage" and is_group and not data.get("fromMe"):
        background_tasks.add_task(_process_message, payload, session_name)

    return {"status": "ok"}


async def _process_message(payload: dict, session_name: str):
    """Processa e persiste uma mensagem de grupo, vinculada ao tenant correto."""
    normalized = normalize_wpp_payload(payload)
    if not normalized:
        return

    data = payload.get("data") or payload

    async with AsyncSessionLocal() as db:
        try:
            source = await _get_source_for_session(db, session_name)
            if not source:
                logger.warning("wpp_unknown_session_fallback", session=session_name)
                source = await _get_or_create_fallback_source(db)

            from app.models.message import Message
            ext_id = normalized.get("external_id")
            if ext_id:
                dup = await db.execute(
                    select(Message).where(Message.external_id == ext_id)
                )
                if dup.scalar_one_or_none():
                    logger.debug("wpp_duplicate_skipped", external_id=ext_id)
                    return

            msg = await processor.process_message(db, normalized, source)
            await db.commit()

            logger.info(
                "wpp_message_ingested",
                group=normalized["conversation_name"],
                sender=normalized["participant_name"],
                type=normalized["message_type"],
                risk=msg.risk_score,
                session=session_name,
            )

            msg_type = normalized["message_type"]
            body_b64 = data.get("body") or ""
            import asyncio
            if body_b64 and len(body_b64) > 100:
                if msg_type in ("audio", "ptt"):
                    asyncio.create_task(_transcribe_and_update(str(msg.id), body_b64))
                elif msg_type in ("image", "video", "document"):
                    mimetype = data.get("mimetype") or ""
                    filename = data.get("filename") or ""
                    asyncio.create_task(
                        _extract_file_and_update(str(msg.id), body_b64, msg_type, mimetype, filename)
                    )

            # Análise Claude para toda mensagem com conteúdo textual
            content = normalized.get("content", "")
            if content and not content.startswith("["):
                asyncio.create_task(_analyze_with_claude(str(msg.id), content))

        except Exception as e:
            await db.rollback()
            logger.error("wpp_message_failed", error=str(e), payload=str(payload)[:200])


async def _analyze_with_claude(message_id: str, content: str):
    from app.services.analysis.claude_analyzer import analyze_single_message
    await analyze_single_message(message_id, content)


async def _extract_file_and_update(
    message_id: str, b64: str, msg_type: str, mimetype: str, filename: str
):
    from app.services.file_extractor import extract_file_content
    from app.services.analysis.heuristics import HeuristicsEngine
    from app.models.message import Message
    import uuid

    text = await extract_file_content(b64, msg_type, mimetype, filename)
    if not text:
        return

    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(
                select(Message).where(Message.id == uuid.UUID(message_id))
            )
            msg = result.scalar_one_or_none()
            if not msg:
                return
            msg.content = text
            engine = HeuristicsEngine()
            analysis = engine.analyze(text)
            msg.risk_score = analysis.risk_score
            msg.is_churn_risk = analysis.is_churn_risk
            msg.is_opportunity = analysis.is_opportunity
            msg.is_followup_needed = analysis.is_followup_needed
            msg.tags = analysis.tags
            await db.commit()
            logger.info("file_content_extracted", message_id=message_id, type=msg_type, chars=len(text))
        except Exception as e:
            await db.rollback()
            logger.error("file_extract_update_failed", error=str(e))

    # Claude re-analisa após extração do conteúdo
    import asyncio
    asyncio.create_task(_analyze_with_claude(message_id, text))


async def _transcribe_and_update(message_id: str, audio_b64: str):
    from app.services.transcription import transcribe_audio_b64
    from app.services.analysis.heuristics import HeuristicsEngine
    from app.models.message import Message
    import uuid

    text = await transcribe_audio_b64(audio_b64)
    if not text:
        return

    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(
                select(Message).where(Message.id == uuid.UUID(message_id))
            )
            msg = result.scalar_one_or_none()
            if not msg:
                return
            msg.content = text
            engine = HeuristicsEngine()
            analysis = engine.analyze(text)
            msg.risk_score = analysis.risk_score
            msg.is_churn_risk = analysis.is_churn_risk
            msg.is_opportunity = analysis.is_opportunity
            msg.is_followup_needed = analysis.is_followup_needed
            msg.tags = analysis.tags
            await db.commit()
            logger.info("audio_transcribed", message_id=message_id, chars=len(text))
        except Exception as e:
            await db.rollback()
            logger.error("audio_transcription_update_failed", error=str(e))

    # Claude analisa o texto transcrito
    import asyncio
    asyncio.create_task(_analyze_with_claude(message_id, text))
