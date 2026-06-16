"""
Endpoints de ingestão de mensagens.
Ponto de entrada de dados no sistema ENVOX Intelligence.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.deps import get_ingest_source
from app.models.source import IngestionSource
from app.schemas.ingest import IngestMessageRequest, IngestBatchRequest, IngestResponse
from app.services.ingestion.processor import ingestion_processor
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter()


@router.post(
    "/ingest/message",
    response_model=IngestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ingerir uma única mensagem",
    description="""
Ingere uma única mensagem de atendimento no sistema.

**Autenticação:** X-API-Key header obrigatório.

**Retorno:** ID da mensagem criada e resultado da análise inicial.
""",
)
async def ingest_message(
    payload: IngestMessageRequest,
    db: AsyncSession = Depends(get_db),
    source: IngestionSource = Depends(get_ingest_source),
):
    try:
        message = await ingestion_processor.process_message(
            db=db,
            payload=payload.model_dump(),
            source=source,
        )
        return IngestResponse(
            success=True,
            message_id=str(message.id),
            messages_processed=1,
        )
    except Exception as e:
        logger.error("ingest_message_error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Erro ao processar mensagem: {str(e)}",
        )


@router.post(
    "/ingest/batch",
    response_model=IngestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ingerir lote de mensagens",
    description="""
Ingere múltiplas mensagens de uma vez (até 500 por request).

Ideal para importação histórica via CSV/JSON ou envio em lote de conectores.
""",
)
async def ingest_batch(
    payload: IngestBatchRequest,
    db: AsyncSession = Depends(get_db),
    source: IngestionSource = Depends(get_ingest_source),
):
    errors = []
    processed = 0
    failed = 0

    for msg_payload in payload.messages:
        try:
            await ingestion_processor.process_message(
                db=db,
                payload=msg_payload.model_dump(),
                source=source,
            )
            processed += 1
        except Exception as e:
            failed += 1
            errors.append(str(e))
            logger.warning("batch_item_failed", error=str(e))

    return IngestResponse(
        success=failed == 0,
        messages_processed=processed,
        messages_failed=failed,
        errors=errors[:10],  # Retorna no máximo 10 erros para não sobrecarregar
    )
