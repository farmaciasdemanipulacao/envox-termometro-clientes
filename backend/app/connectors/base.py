"""
Interface base para conectores de ingestão.
TODA origem de dados deve implementar esta interface.

Princípio: a camada de inteligência não sabe de onde os dados vêm.
O conector é responsável por normalizar o payload para o formato padrão.
"""
from abc import ABC, abstractmethod
from typing import AsyncGenerator


class BaseIngestionConnector(ABC):
    """
    Contrato que todos os conectores de ingestão devem seguir.

    O conector é responsável por:
    1. Conectar-se à origem dos dados
    2. Ler as mensagens no formato nativo da origem
    3. Converter para o NormalizedMessage (formato padrão)
    4. Entregar via yield (streaming) ou lista (batch)
    """

    @property
    @abstractmethod
    def connector_name(self) -> str:
        """Nome único do conector (ex: 'whatsapp_business', 'csv_import')."""
        ...

    @property
    @abstractmethod
    def connector_version(self) -> str:
        """Versão do conector."""
        ...

    @abstractmethod
    async def connect(self) -> bool:
        """
        Estabelece conexão com a origem.
        Returns: True se conectado, False caso contrário.
        """
        ...

    @abstractmethod
    async def disconnect(self) -> None:
        """Encerra conexão com a origem."""
        ...

    @abstractmethod
    async def fetch_messages(self, **kwargs) -> AsyncGenerator[dict, None]:
        """
        Busca mensagens da origem e as entrega no formato normalizado.

        Cada item yielded deve ser um dict com:
        {
            "conversation_external_id": str,
            "conversation_name": str,
            "conversation_type": str,  # group|individual|ticket
            "participant_external_id": str | None,
            "participant_name": str,
            "participant_role": str,   # customer|collaborator|manager|unknown
            "content": str,
            "message_type": str,       # text|image|audio|...
            "sent_at": str,            # ISO 8601
            "external_id": str | None,
            "raw_payload": dict | None,
        }
        """
        ...

    @abstractmethod
    async def health_check(self) -> dict:
        """
        Verifica a saúde da conexão.
        Returns: {"status": "ok"|"error", "details": str}
        """
        ...


class ConnectorError(Exception):
    """Erro genérico de conector."""
    pass


class ConnectorAuthError(ConnectorError):
    """Erro de autenticação no conector."""
    pass


class ConnectorRateLimitError(ConnectorError):
    """Rate limit atingido na origem."""
    pass
