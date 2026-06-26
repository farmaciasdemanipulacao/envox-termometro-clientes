"""
Serviço de transcrição de áudio via Whisper.

Suporta:
  - OpenAI Whisper API (OPENAI_API_KEY)
  - Groq Whisper API  (GROQ_API_KEY) — gratuito, muito rápido
  - Nenhuma chave configurada → retorna None (sem transcrição)

O áudio chega como base64 OGG/Opus vindo do WppConnect.
"""
import base64
import io
import tempfile
import os

from app.core.logging import get_logger

logger = get_logger(__name__)


async def transcribe_audio_b64(audio_b64: str, duration_s: int = 0) -> str | None:
    """
    Recebe o campo `body` base64 do WppConnect (OGG/Opus) e retorna o texto transcrito.
    Retorna None se nenhuma chave de API estiver configurada.
    """
    openai_key = os.getenv("OPENAI_API_KEY", "").strip()
    groq_key   = os.getenv("GROQ_API_KEY", "").strip()

    if not openai_key and not groq_key:
        logger.debug("transcription_skipped", reason="no_api_key")
        return None

    try:
        audio_bytes = base64.b64decode(audio_b64)
    except Exception as e:
        logger.warning("transcription_b64_decode_failed", error=str(e))
        return None

    return await _call_whisper_api(audio_bytes, openai_key, groq_key)


async def _call_whisper_api(audio_bytes: bytes, openai_key: str, groq_key: str) -> str | None:
    """Chama a API Whisper mais adequada."""
    import asyncio

    # Corre em thread separada para não bloquear o event loop
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _sync_call, audio_bytes, openai_key, groq_key)


def _sync_call(audio_bytes: bytes, openai_key: str, groq_key: str) -> str | None:
    """Chamada síncrona ao Whisper (executada em thread)."""
    from openai import OpenAI

    # Groq tem prioridade por ser gratuito e muito rápido
    if groq_key:
        client = OpenAI(api_key=groq_key, base_url="https://api.groq.com/openai/v1")
        model  = "whisper-large-v3-turbo"
    else:
        client = OpenAI(api_key=openai_key)
        model  = "whisper-1"

    audio_file = io.BytesIO(audio_bytes)
    audio_file.name = "audio.ogg"  # OpenAI usa a extensão para detectar formato

    try:
        response = client.audio.transcriptions.create(
            model=model,
            file=audio_file,
            language="pt",
            response_format="text",
        )
        text = response.strip() if isinstance(response, str) else str(response).strip()
        if not text:
            return None
        logger.info("transcription_ok", chars=len(text), model=model)
        return text
    except Exception as e:
        logger.error("transcription_api_failed", error=str(e), model=model)
        return None
