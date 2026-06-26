"""
Cliente da API do WppConnect Server.
Gerencia token de sessão, start/status e configuração de webhook.
"""
import httpx
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# Token em memória — gerado fresh a cada uso (stateless no WppConnect)
_cached_token: str | None = None


class WppConnectClient:
    def __init__(self):
        self.base = settings.WPP_BASE_URL
        self.session = settings.WPP_SESSION
        self.secret = settings.WPP_SECRET

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

    async def ensure_active(self) -> bool:
        """
        Garante que a sessão está ativa e com webhook configurado.
        Chamado no startup do backend e pelo health check job.
        Retorna True se conectado, False se aguardando QR (normal na 1ª vez).
        """
        global _cached_token
        try:
            token = await self.generate_token()
            _cached_token = token

            status = await self.get_status(token)
            current = status.get("status", "UNKNOWN")
            logger.info("wpp_session_status", status=current)

            if current in ("CONNECTED", "isLogged"):
                # Já conectado — re-registra webhook para garantir
                await self.start_session(token, settings.WPP_WEBHOOK_URL)
                logger.info("wpp_session_active_webhook_confirmed")
                return True

            # CLOSED ou outro → tenta iniciar (quem tiver token salvo reconecta)
            result = await self.start_session(token, settings.WPP_WEBHOOK_URL)
            new_status = result.get("status", "UNKNOWN")
            logger.info("wpp_start_session_result", status=new_status)

            if new_status in ("CONNECTED", "isLogged"):
                return True

            # QRCODE → sessão iniciando, aguarda scan — normal
            logger.info("wpp_awaiting_qr_scan")
            return False

        except Exception as e:
            logger.error("wpp_ensure_active_failed", error=str(e))
            return False

    async def get_cached_token(self) -> str:
        global _cached_token
        if not _cached_token:
            _cached_token = await self.generate_token()
        return _cached_token


wpp_client = WppConnectClient()
