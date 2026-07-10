"""
Cliente da API do WppConnect Server.
Suporta múltiplas sessões (multi-tenant) — cada TenantConfig tem sua própria sessão.
"""
import httpx
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class WppConnectClient:
    def __init__(self, base: str | None = None, session: str | None = None, secret: str | None = None):
        self.base = base or settings.WPP_BASE_URL
        self.session = session or settings.WPP_SESSION
        self.secret = secret or settings.WPP_SECRET

    async def generate_token(self) -> str:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                f"{self.base}/api/{self.session}/{self.secret}/generate-token",
                headers={"accept": "*/*"},
            )
            r.raise_for_status()
            data = r.json()
            if not data.get("token"):
                raise RuntimeError("WppConnect não retornou token")
            return data["token"]

    async def get_status(self, token: str) -> dict:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"{self.base}/api/{self.session}/status-session",
                headers={"Authorization": f"Bearer {token}"},
            )
            r.raise_for_status()
            return r.json()

    async def get_phone_number(self, token: str) -> str:
        """
        status-session não retorna o número — só o WppConnect expõe isso via
        get-phone-number (response é o WID cru, ex: "5511999999999@c.us").
        """
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"{self.base}/api/{self.session}/get-phone-number",
                headers={"Authorization": f"Bearer {token}"},
            )
            r.raise_for_status()
            raw = r.json().get("response") or ""
            return raw.split("@")[0] if raw else ""

    async def start_session(self, token: str, webhook_url: str | None = None) -> dict:
        body: dict = {"waitForLogin": False, "autoClose": 0}
        if webhook_url:
            body["webhook"] = webhook_url
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                f"{self.base}/api/{self.session}/start-session",
                json=body,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {token}",
                },
            )
            r.raise_for_status()
            return r.json()

    async def get_qr(self, token: str) -> bytes | None:
        """Busca o QR code como PNG. Retorna bytes ou None se não disponível."""
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                f"{self.base}/api/{self.session}/qrcode-session",
                headers={"Authorization": f"Bearer {token}"},
            )
            if not r.is_success:
                return None
            ct = r.headers.get("content-type", "")
            if ct.startswith("image/"):
                return r.content
            return None

    async def logout(self, token: str) -> None:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                f"{self.base}/api/{self.session}/logout-session",
                headers={"Authorization": f"Bearer {token}"},
            )

    async def ensure_active(self, webhook_url: str | None = None) -> bool:
        """
        Garante que a sessão está ativa e com webhook configurado.
        Retorna True se conectado, False se aguardando QR.
        """
        wh = webhook_url or settings.WPP_WEBHOOK_URL
        try:
            token = await self.generate_token()
            status = await self.get_status(token)
            current = status.get("status", "UNKNOWN")
            logger.info("wpp_session_status", status=current, session=self.session)

            if current in ("CONNECTED", "isLogged"):
                # Sessão já conectada — não chama start_session de novo, isso reabre
                # o ciclo OPENING/PAIRING no WppConnect sem necessidade.
                return True

            result = await self.start_session(token, wh)
            new_status = result.get("status", "UNKNOWN")
            logger.info("wpp_start_session_result", status=new_status, session=self.session)
            return new_status in ("CONNECTED", "isLogged")

        except Exception as e:
            logger.error("wpp_ensure_active_failed", error=str(e), session=self.session)
            return False

    async def get_all_groups(self, token: str) -> list[dict]:
        """Retorna todos os grupos do WhatsApp com metadados.

        Usa /list-chats (não /all-chats): a rota all-chats depende do método
        getAllChats() da lib, deprecado e que nesta versão do servidor volta
        `undefined` (resposta sem "response"), fazendo a tela de Grupos WhatsApp
        aparecer sempre vazia mesmo com a sessão conectada.
        """
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(
                f"{self.base}/api/{self.session}/list-chats",
                json={"onlyGroups": True},
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            )
            r.raise_for_status()
            data = r.json()
            chats = data.get("response", data) if isinstance(data, dict) else data
            groups = []
            for c in chats:
                gid = c.get("id", {})
                if not isinstance(gid, dict):
                    continue
                if gid.get("server") != "g.us":
                    continue
                serialized = gid.get("_serialized", "")
                if not serialized:
                    continue
                meta = c.get("groupMetadata") or {}
                participants = meta.get("participants") or []
                groups.append({
                    "wpp_id": serialized,
                    "raw_id": gid.get("user", ""),
                    "name": c.get("name") or c.get("pushname") or gid.get("user", ""),
                    "participant_count": len(participants),
                    "participants_raw": participants,
                    "last_message_ts": c.get("t") or c.get("timestamp") or 0,
                })
            return groups

    async def get_cached_token(self) -> str:
        return await self.generate_token()

    async def send_text_message(self, token: str, phone: str, text: str, is_group: bool = True) -> dict:
        """Envia mensagem de texto para um contato ou grupo."""
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(
                f"{self.base}/api/{self.session}/send-message",
                json={"phone": phone, "message": text, "isGroup": is_group},
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            )
            r.raise_for_status()
            return r.json()

    async def fetch_messages_history(self, token: str, wpp_id: str, count: int = 2000) -> list[dict]:
        """Busca histórico de mensagens de um grupo via GET /get-messages/{phone}."""
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.get(
                f"{self.base}/api/{self.session}/get-messages/{wpp_id}",
                params={"count": count, "direction": "before"},
                headers={"Authorization": f"Bearer {token}"},
            )
            r.raise_for_status()
            data = r.json()
            msgs = data.get("response", data) if isinstance(data, dict) else data
            return msgs if isinstance(msgs, list) else []

    async def get_media_by_message(self, token: str, message_id: str) -> tuple[str | None, str | None]:
        """
        Baixa a mídia (base64) de uma mensagem específica do histórico.
        get-messages não embute o base64 de áudio/imagem — precisa buscar
        por mensagem. Retorna (base64, mimetype) ou (None, None) se falhar.
        """
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(
                f"{self.base}/api/{self.session}/get-media-by-message/{message_id}",
                headers={"Authorization": f"Bearer {token}"},
            )
            if not r.is_success:
                return None, None
            data = r.json()
            return data.get("base64"), data.get("mimetype")

    async def send_file_base64(
        self, token: str, phone: str, base64_data: str, mime: str,
        filename: str = "imagem.png", caption: str = "", is_group: bool = True,
    ) -> dict:
        """Envia imagem/arquivo via base64 para um contato ou grupo."""
        data_uri = base64_data if base64_data.startswith("data:") else f"data:{mime};base64,{base64_data}"
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                f"{self.base}/api/{self.session}/send-file-base64",
                json={"phone": phone, "base64": data_uri, "filename": filename, "caption": caption, "isGroup": is_group},
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            )
            r.raise_for_status()
            return r.json()

    async def send_voice_base64(
        self, token: str, phone: str, base64_data: str, mime: str = "audio/ogg;codecs=opus", is_group: bool = True,
    ) -> dict:
        """Envia áudio como nota de voz (PTT) via base64 para um contato ou grupo."""
        data_uri = base64_data if base64_data.startswith("data:") else f"data:{mime};base64,{base64_data}"
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                f"{self.base}/api/{self.session}/send-voice-base64",
                json={"phone": phone, "base64Ptt": data_uri, "isGroup": is_group},
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            )
            r.raise_for_status()
            return r.json()


def get_client_for_session(wpp_url: str, wpp_session: str, wpp_secret: str) -> WppConnectClient:
    """Cria um cliente WppConnect para uma sessão/tenant específico."""
    return WppConnectClient(base=wpp_url, session=wpp_session, secret=wpp_secret)


# Singleton para a sessão padrão (admin / backward compat)
wpp_client = WppConnectClient()
