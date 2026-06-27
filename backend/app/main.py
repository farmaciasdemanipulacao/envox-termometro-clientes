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
    """Cria dados iniciais: source padrão, usuário admin, TenantConfig do admin, backfill tenant_id."""
    from sqlalchemy import select, text as sqla_text, update
    from app.models.source import IngestionSource, SourceType
    from app.models.user import User
    from app.models.tenant import TenantConfig
    from app.core.security import hash_password, generate_api_key, hash_api_key

    async with AsyncSessionLocal() as db:
        # Cria IngestionSource padrão para desenvolvimento
        result = await db.execute(
            select(IngestionSource).where(IngestionSource.name == "Development Default")
        )
        if not result.scalar_one_or_none():
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
        admin = user_result.scalar_one_or_none()
        if not admin:
            admin = User(
                username=settings.ADMIN_USERNAME,
                full_name="Administrador ENVOX",
                hashed_password=hash_password(settings.ADMIN_PASSWORD),
                is_active=True,
                is_admin=True,
            )
            db.add(admin)
            await db.flush()
            logger.info("admin_user_created", username=settings.ADMIN_USERNAME)

        # TenantConfig do admin (sessão WPP padrão = termonitor)
        tc_result = await db.execute(
            select(TenantConfig).where(TenantConfig.tenant_id == admin.id)
        )
        if not tc_result.scalar_one_or_none():
            admin_tc = TenantConfig(
                tenant_id=admin.id,
                wpp_session=settings.WPP_SESSION,
                wpp_secret=settings.WPP_SECRET,
                wpp_url=settings.WPP_BASE_URL,
            )
            db.add(admin_tc)

            # IngestionSource do WppConnect para o admin
            wpp_src_r = await db.execute(
                select(IngestionSource).where(IngestionSource.name == "WppConnect Monitor")
            )
            wpp_src = wpp_src_r.scalar_one_or_none()
            if not wpp_src:
                wpp_src = IngestionSource(
                    tenant_id=admin.id,
                    name="WppConnect Monitor",
                    description="Ingestão automática via WppConnect (admin)",
                    source_type=SourceType.WEBHOOK,
                    api_key_hash=hash_api_key(settings.API_KEY_SECRET),
                    is_active=True,
                )
                db.add(wpp_src)
            else:
                # Vincula ao admin se ainda não tem tenant_id
                if not wpp_src.tenant_id:
                    wpp_src.tenant_id = admin.id

            logger.info("admin_tenant_config_created", session=settings.WPP_SESSION)

        await db.commit()

        # Backfill: vincula dados sem tenant_id ao admin
        await db.execute(sqla_text(
            "UPDATE conversations SET tenant_id = :tid WHERE tenant_id IS NULL"
        ), {"tid": admin.id})
        await db.execute(sqla_text(
            "UPDATE ingestion_sources SET tenant_id = :tid WHERE tenant_id IS NULL"
        ), {"tid": admin.id})
        await db.execute(sqla_text(
            "UPDATE daily_summaries SET tenant_id = :tid WHERE tenant_id IS NULL"
        ), {"tid": admin.id})
        await db.commit()
        logger.info("tenant_backfill_done")


async def setup_scheduler():
    """Configura e inicia o APScheduler."""
    from app.core.scheduler import setup_scheduler as _setup
    _setup()


async def _connect_wppconnect():
    """Conecta ao WppConnect Server no startup (em background)."""
    import asyncio
    await asyncio.sleep(3)  # aguarda app estar totalmente pronto
    from app.connectors.wppconnect_server import wpp_client
    connected = await wpp_client.ensure_active()
    if connected:
        logger.info("wpp_startup_connected")
    else:
        logger.info("wpp_startup_awaiting_qr", hint="Escaneie o QR em intel.envox.com.br")


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
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            # Adiciona colunas novas em tabelas existentes (safe: IF NOT EXISTS)
            _sqla_text = __import__("sqlalchemy").text
            for sql in [
                "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS custom_name VARCHAR(500)",
                "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS group_type VARCHAR(50)",
                "ALTER TABLE participants ADD COLUMN IF NOT EXISTS custom_name VARCHAR(500)",
                # Multi-tenant: tenant_id nas tabelas principais
                "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES users(id)",
                "ALTER TABLE ingestion_sources ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES users(id)",
                "ALTER TABLE daily_summaries ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES users(id)",
                "CREATE INDEX IF NOT EXISTS idx_conversations_tenant ON conversations(tenant_id)",
                "CREATE INDEX IF NOT EXISTS idx_summaries_tenant ON daily_summaries(tenant_id)",
                # Controle de acesso e auditoria de usuários
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE",
                # Contas de e-mail monitoradas
                """CREATE TABLE IF NOT EXISTS email_accounts (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    tenant_id UUID NOT NULL REFERENCES users(id),
                    label VARCHAR(200) NOT NULL,
                    host VARCHAR(500) NOT NULL,
                    port INTEGER NOT NULL DEFAULT 993,
                    username VARCHAR(500) NOT NULL,
                    password_enc TEXT NOT NULL,
                    use_ssl BOOLEAN NOT NULL DEFAULT TRUE,
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    last_sync_at TIMESTAMP WITH TIME ZONE,
                    last_error TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
                )""",
                "CREATE INDEX IF NOT EXISTS idx_email_accounts_tenant ON email_accounts(tenant_id)",
            ]:
                try:
                    await conn.execute(_sqla_text(sql))
                except Exception as e:
                    logger.warning("migration_sql_skipped", error=str(e)[:120])
        logger.info("tables_created_or_verified")

    # Dados iniciais
    await create_default_data()

    # Scheduler de jobs
    await setup_scheduler()

    # Conecta/reconecta sessão WppConnect em background
    if settings.WPP_AUTO_RECONNECT:
        import asyncio
        asyncio.create_task(_connect_wppconnect())

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

from app.api.routes import health, auth, ingest, dashboard, alerts, summaries, wppconnect, intelligence, users, tenant, email  # noqa: E501

API_PREFIX = "/api/v1"

app.include_router(health.router, prefix=API_PREFIX, tags=["System"])
app.include_router(auth.router, prefix=API_PREFIX, tags=["Auth"])
app.include_router(users.router, prefix=API_PREFIX, tags=["Usuários"])
app.include_router(tenant.router, prefix=API_PREFIX, tags=["Tenant/WPP"])
app.include_router(ingest.router, prefix=API_PREFIX, tags=["Ingestão"])
app.include_router(dashboard.router, prefix=API_PREFIX, tags=["Dashboard"])
app.include_router(alerts.router, prefix=API_PREFIX, tags=["Alertas"])
app.include_router(summaries.router, prefix=API_PREFIX, tags=["Resumos"])
app.include_router(wppconnect.router, prefix=API_PREFIX, tags=["WhatsApp"])
app.include_router(intelligence.router, prefix=API_PREFIX, tags=["Inteligência"])
app.include_router(email.router, prefix=API_PREFIX, tags=["E-mail"])

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
