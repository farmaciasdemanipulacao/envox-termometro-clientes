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
    """Cria dados iniciais: planos, source padrão, usuário admin, TenantConfig, backfill."""
    from sqlalchemy import select, text as sqla_text, update
    from app.models.source import IngestionSource, SourceType
    from app.models.user import User
    from app.models.tenant import TenantConfig
    from app.models.plan import Plan
    from app.models.subscription import Subscription, SubscriptionStatus
    from app.core.security import hash_password, generate_api_key, hash_api_key
    from datetime import datetime, timezone, timedelta

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
                    # Sem api_key_hash: esta source nunca é resolvida por X-API-Key
                    # (webhook busca por tenant_id/source_type — ver _get_source_for_tenant
                    # em wppconnect.py). Reaproveitar API_KEY_SECRET aqui causava colisão
                    # com "Development Default" e derrubava /ingest/message (D-027).
                    api_key_hash=None,
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

        # Cria planos padrão se não existirem
        plan_count = await db.scalar(select(__import__("sqlalchemy").func.count(Plan.id)))
        if not plan_count:
            default_plans = [
                Plan(
                    slug="starter",
                    name="Starter",
                    description="Ideal para equipes pequenas que estão começando.",
                    price_monthly=97.0,
                    max_groups=5,
                    max_history_days=90,
                    features=[
                        "Até 5 grupos monitorados",
                        "Dashboard em tempo real",
                        "Alertas automáticos",
                        "Resumos diários",
                        "Suporte por e-mail",
                    ],
                    is_active=True,
                    display_order=0,
                    is_featured=False,
                ),
                Plan(
                    slug="pro",
                    name="Pro",
                    description="Para times em crescimento com necessidades avançadas.",
                    price_monthly=197.0,
                    max_groups=20,
                    max_history_days=180,
                    features=[
                        "Até 20 grupos monitorados",
                        "Análise por IA",
                        "Perfilagem de participantes",
                        "Resumos por período",
                        "Envio automático no WhatsApp",
                        "Suporte prioritário",
                    ],
                    is_active=True,
                    display_order=1,
                    is_featured=True,
                ),
                Plan(
                    slug="enterprise",
                    name="Enterprise",
                    description="Escala ilimitada para operações corporativas.",
                    price_monthly=397.0,
                    max_groups=-1,
                    max_history_days=None,  # ilimitado
                    features=[
                        "Grupos ilimitados",
                        "Todas as funcionalidades Pro",
                        "Integrações customizadas",
                        "SLA garantido",
                        "Gerente de conta dedicado",
                        "Onboarding personalizado",
                    ],
                    is_active=True,
                    display_order=2,
                    is_featured=False,
                ),
            ]
            for p in default_plans:
                db.add(p)
            await db.flush()
            logger.info("default_plans_created")

        # Garante que o admin tem assinatura Enterprise
        admin_sub = await db.scalar(
            select(Subscription).where(Subscription.user_id == admin.id)
        )
        if not admin_sub:
            enterprise = await db.scalar(select(Plan).where(Plan.slug == "enterprise"))
            if enterprise:
                now = datetime.now(timezone.utc)
                db.add(Subscription(
                    user_id=admin.id,
                    plan_id=enterprise.id,
                    status=SubscriptionStatus.ACTIVE,
                    current_period_start=now,
                    current_period_end=now + timedelta(days=36500),  # 100 anos
                    notes="Conta administrativa — acesso permanente",
                ))
        await db.commit()
        logger.info("admin_subscription_ensured")

        # Seed das Automações do Sistema (jobs + settings) — só cria se ainda não existir
        from app.models.automation import ScheduledJobConfig, SystemSetting
        from app.core.scheduler import JOB_SCHEDULE_TYPES, _JOB_DEFAULTS

        job_count = await db.scalar(select(__import__("sqlalchemy").func.count(ScheduledJobConfig.id)))
        if not job_count:
            for job_id in JOB_SCHEDULE_TYPES:
                defaults = _JOB_DEFAULTS[job_id]
                db.add(ScheduledJobConfig(
                    job_id=job_id,
                    enabled=True,
                    hour=defaults.get("hour"),
                    minute=defaults.get("minute"),
                    day_of_week=defaults.get("day_of_week"),
                    interval_minutes=defaults.get("interval_minutes"),
                ))
            logger.info("default_job_configs_created")

        setting_count = await db.scalar(select(__import__("sqlalchemy").func.count(SystemSetting.id)))
        if not setting_count:
            default_settings = [
                ("alert_risk_threshold", settings.ALERT_RISK_THRESHOLD, "Risco → alerta", "Score de risco a partir do qual uma mensagem vira alerta."),
                ("alert_critical_threshold", settings.ALERT_CRITICAL_THRESHOLD, "Risco → crítico", "Score de risco a partir do qual o alerta é crítico e dispara push notification."),
                ("alert_opportunity_threshold", settings.ALERT_OPPORTUNITY_THRESHOLD, "Oportunidade", "Score de oportunidade a partir do qual vira alerta de oportunidade comercial."),
                ("followup_overdue_hours", settings.FOLLOWUP_OVERDUE_HOURS, "Follow-up atraso (h)", "Horas sem resposta para um follow-up ser considerado atrasado."),
                ("sla_default_minutes", settings.SLA_DEFAULT_MINUTES, "SLA resposta (min)", "SLA padrão de resposta em minutos para novas conversas."),
                ("data_retention_days", settings.DATA_RETENTION_DAYS, "Retenção de dados (dias)", "Mensagens mais antigas que isso são apagadas automaticamente (LGPD)."),
            ]
            for key, value, label, desc in default_settings:
                db.add(SystemSetting(key=key, value=value, label=label, description=desc))
            logger.info("default_system_settings_created")

        await db.commit()

        # Aplica os valores do banco em settings (efeito imediato, sem depender do .env)
        setting_rows = await db.execute(select(SystemSetting))
        _SETTING_TO_ATTR = {
            "alert_risk_threshold": "ALERT_RISK_THRESHOLD",
            "alert_critical_threshold": "ALERT_CRITICAL_THRESHOLD",
            "alert_opportunity_threshold": "ALERT_OPPORTUNITY_THRESHOLD",
            "followup_overdue_hours": "FOLLOWUP_OVERDUE_HOURS",
            "sla_default_minutes": "SLA_DEFAULT_MINUTES",
            "data_retention_days": "DATA_RETENTION_DAYS",
        }
        for row in setting_rows.scalars().all():
            attr = _SETTING_TO_ATTR.get(row.key)
            if attr:
                setattr(settings, attr, int(row.value))
        logger.info("system_settings_applied")


async def setup_scheduler():
    """Configura e inicia o APScheduler."""
    from app.core.scheduler import setup_scheduler as _setup
    await _setup()


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
                """CREATE TABLE IF NOT EXISTS push_subscriptions (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    endpoint TEXT NOT NULL UNIQUE,
                    p256dh TEXT NOT NULL,
                    auth TEXT NOT NULL,
                    user_agent VARCHAR(500),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
                )""",
                "CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id)",
                "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_monitored BOOLEAN DEFAULT FALSE",
                "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS wpp_group_id VARCHAR(100)",
                "CREATE INDEX IF NOT EXISTS idx_conversations_wpp_group ON conversations(wpp_group_id)",
                """CREATE TABLE IF NOT EXISTS agent_configs (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    tenant_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                    name VARCHAR(100) NOT NULL DEFAULT 'Agente ENVOX',
                    role_label VARCHAR(200),
                    personality TEXT,
                    tone VARCHAR(50) NOT NULL DEFAULT 'profissional',
                    signature VARCHAR(500),
                    avatar_b64 TEXT,
                    avatar_mime VARCHAR(50),
                    expressions JSONB NOT NULL DEFAULT '[]',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
                )""",
                # SaaS: campos adicionais no usuário
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS company_name VARCHAR(500)",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50)",
                # SaaS: planos e assinaturas
                """CREATE TABLE IF NOT EXISTS plans (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    slug VARCHAR(50) NOT NULL UNIQUE,
                    name VARCHAR(100) NOT NULL,
                    description TEXT,
                    price_monthly FLOAT NOT NULL DEFAULT 0.0,
                    max_groups INTEGER NOT NULL DEFAULT 5,
                    features JSONB,
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    display_order INTEGER NOT NULL DEFAULT 0,
                    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
                )""",
                """CREATE TABLE IF NOT EXISTS subscriptions (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                    plan_id UUID NOT NULL REFERENCES plans(id),
                    status VARCHAR(20) NOT NULL DEFAULT 'trial',
                    trial_ends_at TIMESTAMP WITH TIME ZONE,
                    current_period_start TIMESTAMP WITH TIME ZONE,
                    current_period_end TIMESTAMP WITH TIME ZONE,
                    payment_ref VARCHAR(500),
                    cancelled_at TIMESTAMP WITH TIME ZONE,
                    notes VARCHAR(1000),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
                )""",
                "CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id)",
                "CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)",
                # Histórico configurável por plano
                "ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_history_days INTEGER DEFAULT 90",
                # Ajusta planos para defaults corretos (só se ainda no default da coluna = 90)
                "UPDATE plans SET max_history_days = 180 WHERE slug = 'pro'        AND max_history_days = 90",
                "UPDATE plans SET max_history_days = NULL WHERE slug = 'enterprise' AND max_history_days = 90",
                # Automações do Sistema — CRUD (D-026)
                """CREATE TABLE IF NOT EXISTS scheduled_job_configs (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    job_id VARCHAR(50) NOT NULL UNIQUE,
                    enabled BOOLEAN NOT NULL DEFAULT TRUE,
                    hour INTEGER,
                    minute INTEGER,
                    day_of_week VARCHAR(20),
                    interval_minutes INTEGER,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
                )""",
                """CREATE TABLE IF NOT EXISTS system_settings (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    key VARCHAR(100) NOT NULL UNIQUE,
                    value JSONB NOT NULL,
                    label VARCHAR(200),
                    description TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
                )""",
                """CREATE TABLE IF NOT EXISTS custom_alert_rules (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    nome VARCHAR(200) NOT NULL,
                    keywords JSONB NOT NULL DEFAULT '[]',
                    severity VARCHAR(20) NOT NULL DEFAULT 'medium',
                    ativo BOOLEAN NOT NULL DEFAULT TRUE,
                    created_by UUID REFERENCES users(id),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
                )""",
                # Fix: colisão de api_key_hash quebrava /ingest/message (D-027)
                "UPDATE ingestion_sources SET api_key_hash = NULL WHERE name = 'WppConnect Monitor' AND source_type = 'WEBHOOK'",
                "CREATE UNIQUE INDEX IF NOT EXISTS idx_ingestion_sources_api_key_hash ON ingestion_sources(api_key_hash) WHERE api_key_hash IS NOT NULL",
                # Comentário de resolução no alerta — usado como feedback para a IA (D-031)
                "ALTER TABLE alert_events ADD COLUMN IF NOT EXISTS resolution_comment TEXT",
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
## ATENX API

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

from app.api.routes import health, auth, ingest, dashboard, alerts, summaries, wppconnect, intelligence, users, tenant, email, push, agent_config, register, plans, subscriptions, team, system  # noqa: E501

API_PREFIX = "/api/v1"

app.include_router(health.router, prefix=API_PREFIX, tags=["System"])
app.include_router(auth.router, prefix=API_PREFIX, tags=["Auth"])
app.include_router(register.router, prefix=API_PREFIX, tags=["Auth"])
app.include_router(plans.router, prefix=API_PREFIX, tags=["Planos"])
app.include_router(subscriptions.router, prefix=API_PREFIX, tags=["Assinaturas"])
app.include_router(users.router, prefix=API_PREFIX, tags=["Usuários"])
app.include_router(tenant.router, prefix=API_PREFIX, tags=["Tenant/WPP"])
app.include_router(ingest.router, prefix=API_PREFIX, tags=["Ingestão"])
app.include_router(dashboard.router, prefix=API_PREFIX, tags=["Dashboard"])
app.include_router(alerts.router, prefix=API_PREFIX, tags=["Alertas"])
app.include_router(summaries.router, prefix=API_PREFIX, tags=["Resumos"])
app.include_router(wppconnect.router, prefix=API_PREFIX, tags=["WhatsApp"])
app.include_router(intelligence.router, prefix=API_PREFIX, tags=["Inteligência"])
app.include_router(email.router, prefix=API_PREFIX, tags=["E-mail"])
app.include_router(push.router, prefix=API_PREFIX)
app.include_router(agent_config.router, prefix=API_PREFIX)
app.include_router(team.router, prefix=API_PREFIX, tags=["Time"])
app.include_router(system.router, prefix=API_PREFIX, tags=["Sistema"])

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
        return {"message": "ATENX API", "docs": "/docs"}
else:
    @app.get("/")
    async def root():
        return {
            "app": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "docs": "/docs",
            "health": "/api/v1/health",
        }
