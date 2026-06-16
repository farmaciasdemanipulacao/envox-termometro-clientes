"""
ENVOX Intelligence — Ponto de entrada da API FastAPI.
Configura app, middlewares, rotas e startup/shutdown hooks.
"""
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from app.core.config import settings
from app.core.logging import setup_logging, get_logger
from app.db.session import engine, AsyncSessionLocal
from app.db.base import Base

logger = get_logger(__name__)


async def run_migrations():
    """Roda migrações Alembic se AUTO_MIGRATE=true."""
    if settings.AUTO_MIGRATE:
        try:
            import subprocess
            import sys
            result = subprocess.run(
                [sys.executable, "-m", "alembic", "upgrade", "head"],
                capture_output=True,
                text=True,
                cwd=os.path.dirname(os.path.dirname(__file__)),
            )
            if result.returncode == 0:
                logger.info("migrations_applied", output=result.stdout)
            else:
                logger.warning("migrations_failed", error=result.stderr)
        except Exception as e:
            logger.error("migrations_error", error=str(e))


async def create_default_data():
    """Cria dados iniciais: source padrão, usuário admin."""
    from sqlalchemy import select
    from app.models.source import IngestionSource, SourceType
    from app.models.user import User
    from app.core.security import hash_password, generate_api_key, hash_api_key

    async with AsyncSessionLocal() as db:
        # Cria IngestionSource padrão para desenvolvimento
        result = await db.execute(
            select(IngestionSource).where(IngestionSource.name == "Development Default")
        )
        if not result.scalar_one_or_none():
            # API key padrão de desenvolvimento
            api_key_hash = hash_api_key(settings.API_KEY_SECRET)
            dev_source = IngestionSource(
                name="Development Default",
                description="Source padrão para desenvolvimento e testes",
                source_type=SourceType.SIMULATOR,
                api_key_hash=api_key_hash,
                is_active=True,
            )
            db.add(dev_source)
            logger.info("default_source_created")

        # Cria usuário admin padrão
        user_result = await db.execute(
            select(User).where(User.username == settings.ADMIN_USERNAME)
        )
        if not user_result.scalar_one_or_none():
            admin = User(
                username=settings.ADMIN_USERNAME,
                full_name="Administrador ENVOX",
                hashed_password=hash_password(settings.ADMIN_PASSWORD),
                is_active=True,
                is_admin=True,
            )
            db.add(admin)
            logger.info("admin_user_created", username=settings.ADMIN_USERNAME)

        await db.commit()


async def setup_scheduler():
    """Configura e inicia o APScheduler."""
    from app.core.scheduler import setup_scheduler as _setup
    _setup()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle da aplicação — startup e shutdown."""
    # === STARTUP ===
    setup_logging()
    logger.info(
        "app_starting",
        name=settings.APP_NAME,
        version=settings.APP_VERSION,
        env=settings.APP_ENV,
    )

    # Cria tabelas (via Alembic ou create_all em dev)
    if settings.is_development:
        # Em dev, cria tabelas diretamente se não existirem
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("tables_created_or_verified")

    # Dados iniciais
    await create_default_data()

    # Scheduler de jobs
    await setup_scheduler()

    logger.info("app_ready", host=settings.APP_HOST, port=settings.APP_PORT)

    yield

    # === SHUTDOWN ===
    logger.info("app_shutting_down")
    from app.core.scheduler import get_scheduler
    scheduler = get_scheduler()
    if scheduler and scheduler.running:
        scheduler.shutdown(wait=False)
    await engine.dispose()
    logger.info("app_stopped")


# =============================================================================
# CRIAÇÃO DA APP
# =============================================================================

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="""
## ENVOX Intelligence API

Plataforma de inteligência operacional para monitoramento de conversas de atendimento.

### Autenticação
- **Dashboard**: JWT via `POST /api/v1/auth/token`
- **Ingestão**: API Key via header `X-API-Key`

### Fluxo básico
1. Autentique-se em `/api/v1/auth/token`
2. Use o token JWT no header `Authorization: Bearer <token>`
3. Para ingestão, use a X-API-Key no header correspondente
""",
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    lifespan=lifespan,
)

# === MIDDLEWARES ===

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === ROTAS DA API ===

from app.api.routes import health, auth, ingest, dashboard, alerts, summaries

API_PREFIX = "/api/v1"

app.include_router(health.router, prefix=API_PREFIX, tags=["System"])
app.include_router(auth.router, prefix=API_PREFIX, tags=["Auth"])
app.include_router(ingest.router, prefix=API_PREFIX, tags=["Ingestão"])
app.include_router(dashboard.router, prefix=API_PREFIX, tags=["Dashboard"])
app.include_router(alerts.router, prefix=API_PREFIX, tags=["Alertas"])
app.include_router(summaries.router, prefix=API_PREFIX, tags=["Resumos"])

# === STATIC FILES (Frontend) ===
# Serve o dashboard HTML estático
static_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend", "public")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

    @app.get("/")
    async def serve_dashboard():
        """Serve o dashboard principal."""
        index_file = os.path.join(static_dir, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return {"message": "ENVOX Intelligence API", "docs": "/docs"}
else:
    @app.get("/")
    async def root():
        return {
            "app": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "docs": "/docs",
            "health": "/api/v1/health",
        }
