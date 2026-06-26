"""
Webhook do WppConnect Server.
Recebe eventos de mensagens em tempo real e injeta no pipeline de ingestão.

URL: POST /api/v1/webhooks/wppconnect
Configurada no WppConnect via start-session { "webhook": "<url>" }
"""
from fastapi import APIRouter, Request, BackgroundTasks
from sqlalchemy import select

from app.core.logging import get_logger
from app.db.session import AsyncSessionLocal
from app.models.source import IngestionSource, SourceType
from app.services.ingestion.processor import IngestionProcessor
from app.services.ingestion.wpp_normalizer import normalize_wpp_payload

router = APIRouter()
logger = get_logger(__name__)
processor = IngestionProcessor()

# Cache do source_id para não bater no banco a cada mensagem
_wpp_source_id: str | None = None


async def _get_wpp_source(db) -> IngestionSource:
    """Retorna (criando se necessário) a IngestionSource do WppConnect."""
    global _wpp_source_id
    if _wpp_source_id:
        result = await db.execute(
            select(IngestionSource).where(IngestionSource.id == _wpp_source_id)
        )
        source = result.scalar_one_or_none()
        if source:
            return source

    result = await db.execute(
        select(IngestionSource).where(IngestionSource.name == "WppConnect Monitor")
    )
    source = result.scalar_one_or_none()

    if not source:
        from app.core.security import hash_api_key
        from app.core.config import settings
        source = IngestionSource(
            name="WppConnect Monitor",
            description="Ingestão automática via WppConnect Server (número monitor)",
            source_type=SourceType.WEBHOOK,
            api_key_hash=hash_api_key(settings.API_KEY_SECRET),
            is_active=True,
        )
        db.add(source)
        await db.flush()
        logger.info("wpp_source_created", source_id=str(source.id))

    _wpp_source_id = str(source.id)
    return source


@router.get("/wpp/status")
async def get_wpp_status():
    """
    Retorna o status real da sessão WppConnect usando o token do backend (sempre fresco).
    Não requer autenticação JWT — usado pelo painel para mostrar status de conexão.
    """
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
    Responde 200 imediatamente e processa em background para não bloquear o WppConnect.
    """
    try:
        payload = await request.json()
    except Exception:
        # Retorna 200 mesmo em erro — WppConnect não tenta reenvio se receber 4xx/5xx
        logger.warning("wpp_webhook_invalid_json")
        return {"status": "ignored"}

    event = payload.get("event", "")
    # WppConnect envia campos no nível raiz (não em sub-chave "data")
    data = payload.get("data") or payload

    logger.debug("wpp_webhook_received", wpp_event=event)

    # chatId terminando em @g.us = grupo (WhatsApp multi-device usa @lid no campo "from")
    chat_id = str(data.get("chatId") or data.get("from") or "")
    is_group = data.get("isGroupMsg") or data.get("isGroup") or chat_id.endswith("@g.us")
    if event == "onmessage" and is_group and not data.get("fromMe"):
        background_tasks.add_task(_process_message, payload)

    return {"status": "ok"}


async def _process_message(payload: dict):
    """Processa e persiste uma mensagem de grupo."""
    normalized = normalize_wpp_payload(payload)
    if not normalized:
        return

    data = payload.get("data") or payload

    async with AsyncSessionLocal() as db:
        try:
            source = await _get_wpp_source(db)

            # Checa duplicata por external_id antes de processar
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
            )

            # Transcrição de áudio em background (não bloqueia o fluxo principal)
            if normalized["message_type"] == "audio":
                audio_b64 = data.get("body") or ""
                if audio_b64 and len(audio_b64) > 100:
                    import asyncio
                    asyncio.create_task(_transcribe_and_update(str(msg.id), audio_b64))

        except Exception as e:
            await db.rollback()
            logger.error("wpp_message_failed", error=str(e), payload=str(payload)[:200])


async def _transcribe_and_update(message_id: str, audio_b64: str):
    """
    Transcreve o áudio e atualiza o conteúdo da mensagem + re-roda análise.
    Executado como task assíncrona para não bloquear o webhook.
    """
    from app.services.transcription import transcribe_audio_b64
    from app.services.analysis.heuristics import HeuristicsEngine
    from app.models.message import Message
    import uuid

    text = await transcribe_audio_b64(audio_b64)
    if not text:
        return  # Nenhuma chave configurada ou falha

    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(
                select(Message).where(Message.id == uuid.UUID(message_id))
            )
            msg = result.scalar_one_or_none()
            if not msg:
                return

            msg.content = text

            # Re-roda análise heurística no texto transcrito
            engine = HeuristicsEngine()
            analysis = engine.analyze(text)
            msg.risk_score        = analysis.risk_score
            msg.is_churn_risk     = analysis.is_churn_risk
            msg.is_opportunity    = analysis.is_opportunity
            msg.is_followup_needed = analysis.is_followup_needed
            msg.tags              = analysis.tags

            await db.commit()
            logger.info("audio_transcribed", message_id=message_id, chars=len(text))
        except Exception as e:
            await db.rollback()
            logger.error("audio_transcription_update_failed", error=str(e), message_id=message_id)
