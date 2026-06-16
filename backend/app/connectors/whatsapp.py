"""
WhatsApp Business API Connector — STUB.

STATUS: Não implementado no MVP.
DEPENDÊNCIA: Aprovação de conta WhatsApp Business API (Meta).
QUANDO IMPLEMENTAR: Fase 2, após obtenção do WABA e configuração do webhook.

Este stub documenta o contrato e serve como guia para implementação futura.

Referência: https://developers.facebook.com/docs/whatsapp/cloud-api
"""
from typing import AsyncGenerator
from app.connectors.base import BaseIngestionConnector, ConnectorError
from app.core.logging import get_logger

logger = get_logger(__name__)


class WhatsAppBusinessConnector(BaseIngestionConnector):
    """
    Conector para WhatsApp Business Cloud API (Meta).

    Configuração necessária (.env):
    - WHATSAPP_TOKEN: Bearer token da WABA
    - WHATSAPP_PHONE_NUMBER_ID: ID do número de telefone
    - WHATSAPP_WEBHOOK_VERIFY_TOKEN: Token de verificação do webhook
    - WHATSAPP_BUSINESS_ACCOUNT_ID: ID da conta business

    Fluxo de integração:
    1. Meta envia eventos via webhook POST para /api/v1/webhooks/whatsapp
    2. O conector valida a assinatura HMAC-SHA256
    3. Normaliza o payload para o formato padrão
    4. Entrega para o IngestionProcessor

    NOTA: A integração via webhook é passiva — Meta nos envia,
    não buscamos ativamente. Isso é mais confiável e respeita os ToS.
    """

    connector_name = "whatsapp_business"
    connector_version = "0.1.0-stub"

    def __init__(self, config: dict):
        self.token = config.get("WHATSAPP_TOKEN")
        self.phone_number_id = config.get("WHATSAPP_PHONE_NUMBER_ID")
        self.verify_token = config.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN")
        self._connected = False

    async def connect(self) -> bool:
        """STUB: Em produção, validaria token com a API Meta."""
        logger.warning("whatsapp_connector_is_stub", message="WhatsApp connector not implemented")
        raise ConnectorError("WhatsApp Business connector não implementado no MVP. Use webhook ou CSV.")

    async def disconnect(self) -> None:
        self._connected = False

    async def fetch_messages(self, **kwargs) -> AsyncGenerator[dict, None]:
        raise ConnectorError("WhatsApp Business connector não implementado no MVP.")
        # Necessário para satisfazer o tipo de retorno
        if False:  # pragma: no cover
            yield {}

    async def health_check(self) -> dict:
        return {
            "status": "stub",
            "details": "WhatsApp Business connector é um stub. Implementar na Fase 2.",
            "requirements": [
                "Conta Meta Business verificada",
                "WhatsApp Business Account (WABA) aprovada",
                "Número de telefone dedicado",
                "App Meta com permissão whatsapp_business_messaging",
            ]
        }

    @staticmethod
    def normalize_webhook_payload(raw_payload: dict) -> list[dict]:
        """
        Normaliza payload do webhook Meta para o formato padrão.
        STUB: Documenta o formato esperado do webhook Meta.

        Formato do webhook Meta:
        {
            "object": "whatsapp_business_account",
            "entry": [{
                "id": "WABA_ID",
                "changes": [{
                    "value": {
                        "messaging_product": "whatsapp",
                        "metadata": {"phone_number_id": "..."},
                        "messages": [{
                            "from": "PHONE_NUMBER",
                            "id": "MSG_ID",
                            "timestamp": "1234567890",
                            "text": {"body": "MESSAGE_CONTENT"},
                            "type": "text"
                        }]
                    }
                }]
            }]
        }
        """
        normalized = []
        try:
            for entry in raw_payload.get("entry", []):
                for change in entry.get("changes", []):
                    value = change.get("value", {})
                    for msg in value.get("messages", []):
                        normalized.append({
                            "conversation_external_id": f"wa_{value.get('metadata', {}).get('phone_number_id')}_{msg.get('from')}",
                            "conversation_name": f"WA: {msg.get('from')}",
                            "conversation_type": "individual",
                            "participant_external_id": msg.get("from"),
                            "participant_name": msg.get("from", "Desconhecido"),
                            "participant_role": "customer",
                            "content": msg.get("text", {}).get("body", ""),
                            "message_type": msg.get("type", "text"),
                            "sent_at": None,  # TODO: converter timestamp unix
                            "external_id": msg.get("id"),
                            "raw_payload": msg,
                        })
        except Exception as e:
            logger.error("whatsapp_payload_normalization_error", error=str(e))
        return normalized


# PAYLOAD DE EXEMPLO para teste de webhook (use no Postman/curl)
EXAMPLE_WHATSAPP_WEBHOOK_PAYLOAD = {
    "object": "whatsapp_business_account",
    "entry": [{
        "id": "WABA_ID_EXAMPLE",
        "changes": [{
            "value": {
                "messaging_product": "whatsapp",
                "metadata": {"phone_number_id": "123456789"},
                "messages": [{
                    "from": "5511999991234",
                    "id": "msg-wa-example-001",
                    "timestamp": "1718540400",
                    "text": {"body": "Quero cancelar meu contrato"},
                    "type": "text"
                }]
            },
            "field": "messages"
        }]
    }]
}
