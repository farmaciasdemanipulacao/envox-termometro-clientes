"""Schemas de alertas."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class AlertOut(BaseModel):
    """Schema de saída de um alerta."""
    id: str
    conversation_id: str
    conversation_name: Optional[str] = None
    message_id: Optional[str] = None
    alert_type: str
    severity: str
    title: str
    description: str
    excerpt: Optional[str] = None
    status: str
    triggered_at: datetime
    resolved_at: Optional[datetime] = None
    resolution_comment: Optional[str] = None

    model_config = {"from_attributes": True}


class AlertUpdateRequest(BaseModel):
    """Atualização de status/comentário de alerta."""
    status: Optional[str] = None  # acknowledged|resolved|dismissed — omitir para só salvar o comentário
    comment: Optional[str] = None  # comentário do operador — usado como feedback para a IA

    model_config = {
        "json_schema_extra": {
            "example": {"status": "resolved", "comment": "Falso positivo: cliente só estava brincando."}
        }
    }
