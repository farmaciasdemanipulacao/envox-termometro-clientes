"""Schemas de ingestão de mensagens."""
from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, Field


class IngestMessageRequest(BaseModel):
    """
    Payload de ingestão de uma única mensagem.
    Este é o contrato padrão que qualquer conector deve usar.
    """
    # Conversa/Grupo
    conversation_external_id: str = Field(..., description="ID único da conversa na origem")
    conversation_name: str = Field(..., description="Nome do grupo ou conversa")
    conversation_type: str = Field(default="group", description="group|individual|ticket")

    # Participante
    participant_external_id: Optional[str] = Field(None, description="ID do participante na origem")
    participant_name: str = Field(..., description="Nome do autor da mensagem")
    participant_role: str = Field(default="unknown", description="customer|collaborator|manager|unknown")

    # Mensagem
    content: str = Field(..., description="Conteúdo da mensagem", min_length=1)
    message_type: str = Field(default="text", description="text|image|audio|video|document|system")
    sent_at: Optional[datetime] = Field(None, description="Timestamp original da mensagem (ISO 8601)")
    external_id: Optional[str] = Field(None, description="ID da mensagem na plataforma de origem")
    raw_payload: Optional[dict[str, Any]] = Field(None, description="Payload bruto para auditoria")

    model_config = {
        "json_schema_extra": {
            "example": {
                "conversation_external_id": "grupo-clientes-vip-001",
                "conversation_name": "Clientes VIP - Suporte",
                "conversation_type": "group",
                "participant_external_id": "5511999991234",
                "participant_name": "João Silva",
                "participant_role": "customer",
                "content": "Preciso cancelar meu contrato urgente, estou muito insatisfeito!",
                "message_type": "text",
                "sent_at": "2024-06-16T10:30:00Z",
                "external_id": "msg-wa-00123",
            }
        }
    }


class IngestBatchRequest(BaseModel):
    """Ingestão em lote — até 500 mensagens por request."""
    messages: list[IngestMessageRequest] = Field(
        ..., description="Lista de mensagens", max_length=500
    )


class IngestResponse(BaseModel):
    """Resposta da ingestão."""
    success: bool
    message_id: Optional[str] = None
    messages_processed: int = 0
    messages_failed: int = 0
    errors: list[str] = []
