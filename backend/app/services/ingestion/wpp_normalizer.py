"""
Normaliza o payload de webhook do WppConnect Server para o formato
padrão aceito pelo IngestionProcessor.

WppConnect envia os campos diretamente no nível raiz do payload:
  { "event": "onmessage", "id": "...", "body": "...", "from": "...@g.us", "isGroupMsg": true, ... }
Processor espera: { "conversation_external_id": ..., "content": ..., ... }
"""
from datetime import datetime, timezone


def normalize_wpp_payload(payload: dict) -> dict | None:
    """
    Converte um evento WppConnect em payload normalizado.
    Retorna None se a mensagem deve ser ignorada.
    """
    event = payload.get("event")
    # WppConnect coloca os campos no nível raiz; "data" sub-chave não existe
    data = payload.get("data") or payload

    # Só processa mensagens recebidas em grupos
    if event != "onmessage":
        return None
    if data.get("fromMe"):
        return None

    # "Excluir para todos" no WhatsApp — desconsidera o evento e mantém a
    # mensagem original já gravada no banco intacta (decisão do Gus, 2026-07-07:
    # mensagens nunca são apagadas/alteradas por causa de uma exclusão remota).
    wpp_type_raw = data.get("type")
    if (
        wpp_type_raw in ("revoked", "revoke")
        or data.get("isRevoked")
        or data.get("subtype") in ("message_deletion", "revoke")
    ):
        return None

    # chatId terminando em @g.us = grupo (WppConnect/WhatsApp multi-device pode ter isGroupMsg=False)
    chat_id = str(data.get("chatId") or data.get("from") or "")
    is_group = data.get("isGroupMsg") or data.get("isGroup") or chat_id.endswith("@g.us")
    if not is_group:
        return None

    # ── Grupo (conversa) ───────────────────────────────────────
    group_id = chat_id or data.get("from", "unknown@g.us")
    group_name = data.get("chatName") or data.get("notifyName") or group_id.split("@")[0]

    # ── Remetente (participante) ────────────────────────────────
    sender = data.get("sender") or {}
    sender_id = sender.get("id") or data.get("author") or "unknown@c.us"
    sender_name = (
        sender.get("pushname")
        or sender.get("name")
        or sender_id.split("@")[0]
    )

    # ── Conteúdo e tipo ────────────────────────────────────────
    content, msg_type = _extract_content(data)

    # ── Timestamp ──────────────────────────────────────────────
    ts = data.get("timestamp")
    if ts:
        sent_at = datetime.fromtimestamp(int(ts), tz=timezone.utc).isoformat()
    else:
        sent_at = datetime.now(timezone.utc).isoformat()

    return {
        "conversation_external_id": group_id,
        "conversation_name": group_name,
        "conversation_type": "group",
        "participant_external_id": sender_id,
        "participant_name": sender_name,
        "participant_role": "unknown",   # LLM vai classificar depois
        "content": content,
        "message_type": msg_type,
        "sent_at": sent_at,
        "external_id": data.get("id"),
        "raw_payload": data,
    }


def _extract_content(data: dict) -> tuple[str, str]:
    """Retorna (conteúdo textual, message_type string)."""
    wpp_type = data.get("type", "chat")
    body = data.get("body") or ""
    caption = data.get("caption") or ""
    filename = data.get("filename") or "arquivo"
    duration = data.get("duration") or 0

    if wpp_type == "chat":
        return (body or "[Mensagem vazia]"), "text"

    if wpp_type in ("ptt", "audio"):
        label = f"[Mensagem de voz — {duration}s]" if duration else "[Mensagem de voz]"
        return label, "audio"

    if wpp_type == "image":
        text = caption or "[Imagem]"
        return text, "image"

    if wpp_type == "document":
        label = f"[Documento: {filename}]"
        if caption:
            label += f" — {caption}"
        return label, "document"

    if wpp_type == "video":
        text = caption or "[Vídeo]"
        return text, "video"

    if wpp_type == "sticker":
        return "[Figurinha]", "text"

    if wpp_type == "location":
        return "[Localização compartilhada]", "text"

    if wpp_type == "vcard":
        return "[Contato compartilhado]", "text"

    # Fallback genérico
    return body or f"[{wpp_type}]", "text"
