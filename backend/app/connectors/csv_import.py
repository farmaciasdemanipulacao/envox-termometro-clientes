"""
CSV/JSON Import Connector — FUNCIONAL no MVP.
Permite importar histórico de mensagens de arquivos CSV ou JSON.

Formato CSV esperado (colunas):
    conversation_id, conversation_name, participant_id, participant_name,
    participant_role, content, message_type, sent_at, external_id

Formato JSON esperado:
    Lista de objetos com as mesmas chaves do CSV.
"""
import csv
import json
import io
from typing import AsyncGenerator

from app.connectors.base import BaseIngestionConnector
from app.core.logging import get_logger

logger = get_logger(__name__)


class CSVImportConnector(BaseIngestionConnector):
    """
    Importa mensagens de arquivos CSV ou JSON.
    Funcional no MVP — usado para carga de histórico.
    """

    connector_name = "csv_import"
    connector_version = "1.0.0"

    def __init__(self, content: str, format: str = "csv"):
        self.content = content
        self.format = format  # csv | json
        self._connected = False

    async def connect(self) -> bool:
        self._connected = True
        return True

    async def disconnect(self) -> None:
        self._connected = False

    async def fetch_messages(self, **kwargs) -> AsyncGenerator[dict, None]:
        """Lê o arquivo e entrega mensagens normalizadas."""
        if self.format == "json":
            records = json.loads(self.content)
            if isinstance(records, dict):
                records = records.get("messages", [records])
        else:
            reader = csv.DictReader(io.StringIO(self.content))
            records = list(reader)

        for record in records:
            normalized = self._normalize_record(record)
            if normalized:
                yield normalized

    async def health_check(self) -> dict:
        try:
            content_size = len(self.content.encode())
            return {
                "status": "ok",
                "format": self.format,
                "content_size_bytes": content_size,
            }
        except Exception as e:
            return {"status": "error", "details": str(e)}

    def _normalize_record(self, record: dict) -> dict | None:
        """Normaliza um registro CSV/JSON para o formato padrão."""
        content = record.get("content") or record.get("message") or record.get("texto")
        if not content:
            return None

        return {
            "conversation_external_id": (
                record.get("conversation_id") or
                record.get("conversation_external_id") or
                "imported-default"
            ),
            "conversation_name": (
                record.get("conversation_name") or
                record.get("grupo") or
                "Importado"
            ),
            "conversation_type": record.get("conversation_type", "group"),
            "participant_external_id": (
                record.get("participant_id") or
                record.get("participant_external_id") or
                record.get("autor_id")
            ),
            "participant_name": (
                record.get("participant_name") or
                record.get("autor") or
                "Desconhecido"
            ),
            "participant_role": (
                record.get("participant_role") or
                record.get("papel") or
                "unknown"
            ),
            "content": str(content).strip(),
            "message_type": record.get("message_type", "text"),
            "sent_at": record.get("sent_at") or record.get("data") or record.get("timestamp"),
            "external_id": record.get("external_id") or record.get("id"),
            "raw_payload": record,
        }


# CSV de exemplo — use para testar a importação
EXAMPLE_CSV = """conversation_id,conversation_name,participant_id,participant_name,participant_role,content,message_type,sent_at
grupo-001,Clientes Premium,cli-001,Maria Fernanda,customer,Olá, quero saber sobre o contrato,text,2024-06-16T09:00:00Z
grupo-001,Clientes Premium,col-001,Carlos ENVOX,collaborator,Bom dia Maria! Posso te ajudar,text,2024-06-16T09:05:00Z
grupo-001,Clientes Premium,cli-001,Maria Fernanda,customer,Preciso cancelar urgente,text,2024-06-16T09:10:00Z
"""

# JSON de exemplo
EXAMPLE_JSON = json.dumps({
    "messages": [
        {
            "conversation_id": "grupo-001",
            "conversation_name": "Clientes Premium",
            "participant_id": "cli-001",
            "participant_name": "Maria Fernanda",
            "participant_role": "customer",
            "content": "Quero uma proposta de upgrade",
            "message_type": "text",
            "sent_at": "2024-06-16T10:00:00Z",
        }
    ]
})
