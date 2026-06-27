"""
Extração de conteúdo de arquivos recebidos via WhatsApp.

Tipos suportados:
  - image (JPG, PNG, WEBP, GIF)  → Claude Sonnet (visão) > Groq llama-4-scout > OpenAI gpt-4o-mini
  - document PDF                  → pypdf (texto nativo)
  - document DOCX                 → python-docx
  - document TXT                  → UTF-8 decode
  - document XLSX                 → openpyxl
  - video (MP4, etc.)             → ffmpeg extrai áudio → Whisper (Groq > OpenAI)

Prioridade de provider: Anthropic Claude > Groq > OpenAI
Quando nenhuma chave estiver configurada, retorna None para tipos que dependem de IA.
"""
import asyncio
import base64
import io
import os
import tempfile

from app.core.logging import get_logger

logger = get_logger(__name__)

VISION_PROMPT = (
    "Descreva detalhadamente o conteúdo desta imagem em português. "
    "Se for um documento ou texto visível, transcreva-o. "
    "Se for um produto ou objeto, descreva suas características. "
    "Seja objetivo e direto."
)


async def extract_file_content(
    b64: str,
    msg_type: str,
    mimetype: str = "",
    filename: str = "",
) -> str | None:
    """
    Entry point principal. Retorna texto extraído ou None.

    Args:
        b64: conteúdo base64 do arquivo (campo `body` do WppConnect)
        msg_type: message_type normalizado (image, video, document, audio)
        mimetype: MIME type enviado pelo WppConnect
        filename: nome do arquivo (documentos)
    """
    if not b64 or len(b64) < 50:
        return None

    try:
        data = base64.b64decode(b64)
    except Exception as e:
        logger.warning("file_extractor_decode_failed", error=str(e))
        return None

    mt = (mimetype or "").lower()
    fn = (filename or "").lower()

    if msg_type == "image" or mt.startswith("image/"):
        return await _describe_image(b64, mimetype or "image/jpeg")

    if msg_type in ("video",) or mt.startswith("video/"):
        return await _extract_video_audio(data, filename)

    if msg_type == "document":
        if "pdf" in mt or fn.endswith(".pdf"):
            return _extract_pdf(data)
        if fn.endswith(".docx") or "wordprocessingml" in mt or "officedocument" in mt:
            return _extract_docx(data)
        if fn.endswith(".doc"):
            return f"[Documento Word .doc — transcrição não suportada: {filename}]"
        if fn.endswith((".xlsx", ".xls")) or "spreadsheet" in mt or "excel" in mt:
            return _extract_excel(data, fn)
        if "text" in mt or fn.endswith(".txt") or fn.endswith(".csv"):
            return _extract_text(data)
        # Fallback: tenta como texto
        text = _extract_text(data)
        if text:
            return text
        return f"[{filename or 'Documento sem texto extraível'}]"

    return None


# ── Imagens: Vision API ───────────────────────────────────────────────────────

async def _describe_image(b64: str, mimetype: str) -> str | None:
    anthropic_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    openai_key = os.getenv("OPENAI_API_KEY", "").strip()
    groq_key = os.getenv("GROQ_API_KEY", "").strip()

    if not anthropic_key and not openai_key and not groq_key:
        logger.debug("vision_skipped", reason="no_api_key")
        return None

    loop = asyncio.get_event_loop()

    if anthropic_key:
        return await loop.run_in_executor(None, _sync_vision_claude, b64, mimetype, anthropic_key)
    return await loop.run_in_executor(None, _sync_vision_openai, b64, mimetype, openai_key, groq_key)


def _sync_vision_claude(b64: str, mimetype: str, api_key: str) -> str | None:
    import anthropic

    model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")
    client = anthropic.Anthropic(api_key=api_key)

    try:
        resp = client.messages.create(
            model=model,
            max_tokens=500,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {"type": "base64", "media_type": mimetype, "data": b64},
                    },
                    {"type": "text", "text": VISION_PROMPT},
                ],
            }],
        )
        text = (resp.content[0].text or "").strip()
        if not text:
            return None
        logger.info("vision_ok", chars=len(text), model=model, provider="claude")
        return f"[Imagem] {text}"
    except Exception as e:
        logger.error("vision_claude_failed", error=str(e), model=model)
        return None


def _sync_vision_openai(b64: str, mimetype: str, openai_key: str, groq_key: str) -> str | None:
    from openai import OpenAI

    data_url = f"data:{mimetype};base64,{b64}"

    if groq_key:
        client = OpenAI(api_key=groq_key, base_url="https://api.groq.com/openai/v1")
        model = os.getenv("VISION_MODEL_GROQ", "meta-llama/llama-4-scout-17b-16e-instruct")
    else:
        client = OpenAI(api_key=openai_key)
        model = os.getenv("VISION_MODEL_OPENAI", "gpt-4o-mini")

    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": data_url}},
                    {"type": "text", "text": VISION_PROMPT},
                ],
            }],
            max_tokens=500,
        )
        text = (resp.choices[0].message.content or "").strip()
        if not text:
            return None
        logger.info("vision_ok", chars=len(text), model=model, provider="openai_groq")
        return f"[Imagem] {text}"
    except Exception as e:
        logger.error("vision_openai_failed", error=str(e), model=model)
        return None


# ── Vídeo: extrai áudio → Whisper ────────────────────────────────────────────

async def _extract_video_audio(data: bytes, filename: str = "") -> str | None:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _sync_video_extract, data, filename)


def _sync_video_extract(data: bytes, filename: str = "") -> str | None:
    try:
        from pydub import AudioSegment
    except ImportError:
        logger.debug("video_extract_skipped", reason="pydub_not_installed")
        return None

    openai_key = os.getenv("OPENAI_API_KEY", "").strip()
    groq_key = os.getenv("GROQ_API_KEY", "").strip()
    if not openai_key and not groq_key:
        logger.debug("video_transcription_skipped", reason="no_api_key")
        return None

    try:
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
            f.write(data)
            tmp_video = f.name

        audio = AudioSegment.from_file(tmp_video)
        with tempfile.NamedTemporaryFile(suffix=".ogg", delete=False) as f:
            tmp_audio = f.name
        audio.export(tmp_audio, format="ogg", codec="libopus")

        with open(tmp_audio, "rb") as af:
            audio_bytes = af.read()

        os.unlink(tmp_video)
        os.unlink(tmp_audio)
    except Exception as e:
        logger.error("video_audio_extract_failed", error=str(e))
        return None

    # Reutiliza lógica do Whisper
    from openai import OpenAI
    if groq_key:
        client = OpenAI(api_key=groq_key, base_url="https://api.groq.com/openai/v1")
        model = "whisper-large-v3-turbo"
    else:
        client = OpenAI(api_key=openai_key)
        model = "whisper-1"

    try:
        audio_file = io.BytesIO(audio_bytes)
        audio_file.name = "audio.ogg"
        resp = client.audio.transcriptions.create(
            model=model, file=audio_file, language="pt", response_format="text"
        )
        text = resp.strip() if isinstance(resp, str) else str(resp).strip()
        if not text:
            return None
        logger.info("video_transcribed", chars=len(text), model=model)
        return f"[Vídeo — transcrição] {text}"
    except Exception as e:
        logger.error("video_transcription_failed", error=str(e))
        return None


# ── PDF ───────────────────────────────────────────────────────────────────────

def _extract_pdf(data: bytes) -> str | None:
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(data))
        pages = []
        for page in reader.pages:
            t = page.extract_text()
            if t:
                pages.append(t.strip())
        text = "\n\n".join(pages)
        if not text.strip():
            return "[PDF sem texto extraível — pode ser escaneado]"
        logger.info("pdf_extracted", pages=len(reader.pages), chars=len(text))
        return f"[PDF] {text[:4000]}"
    except Exception as e:
        logger.error("pdf_extract_failed", error=str(e))
        return None


# ── DOCX ──────────────────────────────────────────────────────────────────────

def _extract_docx(data: bytes) -> str | None:
    try:
        from docx import Document
        doc = Document(io.BytesIO(data))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        text = "\n".join(paragraphs)
        if not text.strip():
            return "[DOCX sem conteúdo de texto]"
        logger.info("docx_extracted", chars=len(text))
        return f"[Word] {text[:4000]}"
    except Exception as e:
        logger.error("docx_extract_failed", error=str(e))
        return None


# ── Excel ─────────────────────────────────────────────────────────────────────

def _extract_excel(data: bytes, filename: str = "") -> str | None:
    if filename.endswith(".xls"):
        return f"[Excel .xls — transcrição não suportada: {filename}]"
    try:
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(data), read_only=True, data_only=True)
        lines = []
        for sheet in wb.worksheets:
            lines.append(f"[Aba: {sheet.title}]")
            for row in sheet.iter_rows(values_only=True):
                cells = [str(c) for c in row if c is not None]
                if cells:
                    lines.append("\t".join(cells))
            if len(lines) > 200:
                lines.append("... (truncado)")
                break
        text = "\n".join(lines)
        logger.info("excel_extracted", chars=len(text))
        return f"[Excel] {text[:4000]}"
    except Exception as e:
        logger.error("excel_extract_failed", error=str(e))
        return None


# ── Texto plano ───────────────────────────────────────────────────────────────

def _extract_text(data: bytes) -> str | None:
    for enc in ("utf-8", "latin-1", "cp1252"):
        try:
            text = data.decode(enc).strip()
            if text:
                logger.info("text_extracted", chars=len(text), encoding=enc)
                return text[:4000]
        except Exception:
            continue
    return None
