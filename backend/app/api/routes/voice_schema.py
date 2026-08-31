"""Bootstrap idempotente do schema do módulo Voz do Cliente.

O repositório legado ainda não possui migrations Alembic versionadas. Para o módulo
novo, criamos somente as tabelas voice_* com checkfirst=True no startup, sem tocar
nas tabelas operacionais existentes do ATENX/ENVOX Intelligence.
"""
from fastapi import APIRouter

from app.db.session import engine
from app.models.voice import VOICE_TABLES
from app.core.logging import get_logger

router = APIRouter()
logger = get_logger(__name__)


@router.on_event("startup")
async def ensure_voice_schema():
    try:
        async with engine.begin() as conn:
            await conn.run_sync(
                lambda sync_conn: __import__("sqlalchemy").MetaData().create_all(sync_conn)
            )
            # create_all acima com MetaData vazio é no-op deliberado; a criação real
            # abaixo limita explicitamente às tabelas do módulo para isolamento.
            await conn.run_sync(
                lambda sync_conn: VOICE_TABLES[0].metadata.create_all(
                    sync_conn,
                    tables=VOICE_TABLES,
                    checkfirst=True,
                )
            )
        logger.info("voice_schema_ready", tables=[t.name for t in VOICE_TABLES])
    except Exception as exc:
        # Não derruba o restante do ENVOX Intelligence por falha do módulo isolado.
        logger.error("voice_schema_failed", error=str(exc))
