"""Healthcheck endpoint + registro dos módulos independentes de Voz do Cliente."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.db.session import get_db
from app.core.config import settings
from app.api.routes.voice import router as voice_router
from app.api.routes.voice_secovi import router as voice_secovi_router
from app.api.routes.voice_schema import router as voice_schema_router

router = APIRouter()

# O main.py já inclui health.router em /api/v1. Incluir os subrouters aqui mantém
# o módulo desacoplado do restante do app e evita alterar o roteador central legado.
router.include_router(voice_schema_router)
router.include_router(voice_router)
router.include_router(voice_secovi_router)


@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    """Verifica saúde da aplicação e conexão com banco."""
    db_status = "ok"
    try:
        await db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"error: {str(e)}"

    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.APP_ENV,
        "database": db_status,
        "modules": {"voice_of_customer": "enabled"},
    }
