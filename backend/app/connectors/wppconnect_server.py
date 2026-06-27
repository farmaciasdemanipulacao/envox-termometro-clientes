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
                await self.start_session(token, wh)
                logger.info("wpp_session_active_webhook_confirmed", session=self.session)
                return True

            result = await self.start_session(token, wh)
            new_status = result.get("status", "UNKNOWN")
            logger.info("wpp_start_session_result", status=new_status, session=self.session)
            return new_status in ("CONNECTED", "isLogged")

        except Exception as e:
            logger.error("wpp_ensure_active_failed", error=str(e), session=self.session)
            return False

    async def get_cached_token(self) -> str:
        return await self.generate_token()


def get_client_for_session(wpp_url: str, wpp_session: str, wpp_secret: str) -> WppConnectClient:
    """Cria um cliente WppConnect para uma sessão/tenant específico."""
    return WppConnectClient(base=wpp_url, session=wpp_session, secret=wpp_secret)


# Singleton para a sessão padrão (admin / backward compat)
wpp_client = WppConnectClient()
