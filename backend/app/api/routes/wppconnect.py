"""
Webhook do WppConnect Server — recebe eventos e roteia para o tenant correto.
URL: POST /api/v1/webhooks/wppconnect
"""
from fastapi import APIRouter, Request, BackgroundTasks
from sqlalchemy import select

from app.core.logging import get_logger
from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.source import IngestionSource, SourceType
from app.models.tenant import TenantConfig
from app.services.ingestion.processor import IngestionProcessor
from app.services.ingestion.wpp_normalizer import normalize_wpp_payload

router = APIRouter()
logger = get_logger(__name__)
processor = IngestionProcessor()


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
        from app.core.security import hash_api_key
        source = IngestionSource(
            name="WppConnect Monitor",
            description="Ingestão automática via WppConnect (fallback)",
            source_type=SourceType.WEBHOOK,
            api_key_hash=hash_api_key(settings.API_KEY_SECRET),
            is_active=True,
        )
        db.add(source)
        await db.flush()
    return source


@router.get("/wpp/status")
async def get_wpp_status():
    """Status da sessão padrão (admin). Sem auth — compatibilidade com versão anterior."""
    from app.connectors.wppconnect_server import wpp_client
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
