"""
APScheduler — jobs agendados da plataforma ENVOX Intelligence.

Jobs configurados:
- DailySummaryJob: gera resumo executivo todo dia às 06:00
- AlertScanJob: escaneia alertas pendentes a cada 15 min
- MetricsUpdateJob: atualiza métricas de grupos/colaboradores a cada 30 min
- CleanupJob: remove dados antigos (retenção LGPD) todo domingo
"""
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_scheduler: AsyncIOScheduler | None = None

# Tipo de agendamento de cada job — usado tanto no setup quanto na edição via API.
# cron_daily: editável por hour/minute | cron_weekly: editável por day_of_week+hour+minute
# interval: editável por interval_minutes
JOB_SCHEDULE_TYPES = {
    "daily_summary": "cron_daily",
    "alert_scan": "interval",
    "metrics_update": "interval",
    "wpp_health_check": "interval",
    "eod_briefing": "cron_daily",
    "data_cleanup": "cron_weekly",
}

# Defaults de código — usados quando não há override no banco (ScheduledJobConfig)
_JOB_DEFAULTS = {
    "daily_summary": {"hour": settings.SUMMARY_SCHEDULE_HOUR, "minute": settings.SUMMARY_SCHEDULE_MINUTE},
    "alert_scan": {"interval_minutes": settings.ALERT_SCAN_INTERVAL_MIN},
    "metrics_update": {"interval_minutes": settings.METRICS_UPDATE_INTERVAL_MIN},
    "wpp_health_check": {"interval_minutes": settings.WPP_HEALTH_CHECK_INTERVAL_MIN},
    "eod_briefing": {"hour": 18, "minute": 0},
    "data_cleanup": {"day_of_week": "sun", "hour": 2, "minute": 0},
}

_JOB_NAMES = {
    "daily_summary": "Geração de Resumo Diário",
    "alert_scan": "Scan de Alertas",
    "metrics_update": "Atualização de Métricas",
    "wpp_health_check": "Health Check WppConnect",
    "eod_briefing": "Briefing de Fim de Dia (18h)",
    "data_cleanup": "Limpeza de Dados (LGPD)",
}

_JOB_FUNCS = {
    "daily_summary": lambda: run_daily_summary_job,
    "alert_scan": lambda: run_alert_scan_job,
    "metrics_update": lambda: run_metrics_update_job,
    "wpp_health_check": lambda: run_wpp_health_check_job,
    "eod_briefing": lambda: run_eod_briefing_job,
    "data_cleanup": lambda: run_cleanup_job,
}

_JOB_MISFIRE_GRACE = {
    "daily_summary": 300,
    "alert_scan": 60,
    "wpp_health_check": 60,
    "eod_briefing": 600,
}


def get_scheduler() -> AsyncIOScheduler | None:
    return _scheduler


def build_trigger(job_id: str, cfg: dict):
    """Monta o trigger (Cron/Interval) de um job a partir de um dict de config (hour/minute/day_of_week/interval_minutes)."""
    schedule_type = JOB_SCHEDULE_TYPES[job_id]
    defaults = _JOB_DEFAULTS[job_id]
    if schedule_type == "cron_daily":
        hour = cfg.get("hour") if cfg.get("hour") is not None else defaults["hour"]
        minute = cfg.get("minute") if cfg.get("minute") is not None else defaults["minute"]
        return CronTrigger(hour=hour, minute=minute)
    if schedule_type == "cron_weekly":
        hour = cfg.get("hour") if cfg.get("hour") is not None else defaults["hour"]
        minute = cfg.get("minute") if cfg.get("minute") is not None else defaults["minute"]
        dow = cfg.get("day_of_week") or defaults["day_of_week"]
        return CronTrigger(day_of_week=dow, hour=hour, minute=minute)
    # interval
    interval_minutes = cfg.get("interval_minutes") if cfg.get("interval_minutes") is not None else defaults["interval_minutes"]
    return IntervalTrigger(minutes=interval_minutes)


async def _load_job_configs(db) -> dict:
    """Carrega os overrides de ScheduledJobConfig do banco, indexados por job_id."""
    from app.models.automation import ScheduledJobConfig
    from sqlalchemy import select as _sel

    result = await db.execute(_sel(ScheduledJobConfig))
    rows = result.scalars().all()
    return {
        r.job_id: {
            "enabled": r.enabled,
            "hour": r.hour,
            "minute": r.minute,
            "day_of_week": r.day_of_week,
            "interval_minutes": r.interval_minutes,
        }
        for r in rows
    }


async def setup_scheduler() -> AsyncIOScheduler:
    global _scheduler

    _scheduler = AsyncIOScheduler(timezone="America/Sao_Paulo")

    from app.db.session import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        job_configs = await _load_job_configs(db)

    for job_id in JOB_SCHEDULE_TYPES:
        cfg = job_configs.get(job_id, {})
        trigger = build_trigger(job_id, cfg)
        _scheduler.add_job(
            func=_JOB_FUNCS[job_id](),
            trigger=trigger,
            id=job_id,
            name=_JOB_NAMES[job_id],
            replace_existing=True,
            misfire_grace_time=_JOB_MISFIRE_GRACE.get(job_id),
        )

    _scheduler.start()

    # Aplica enabled=False (pausa) para jobs desativados pelo admin
    for job_id, cfg in job_configs.items():
        if cfg.get("enabled") is False and _scheduler.get_job(job_id):
            _scheduler.pause_job(job_id)

    logger.info(
        "scheduler_started",
        jobs=[j.id for j in _scheduler.get_jobs()],
        summary_hour=settings.SUMMARY_SCHEDULE_HOUR,
        alert_scan_interval=settings.ALERT_SCAN_INTERVAL_MIN,
    )
    return _scheduler


def apply_job_runtime_config(job_id: str, cfg: dict) -> None:
    """
    Reaplica a configuração (trigger + enabled/disabled) de um job já rodando no scheduler.
    Usado pelo endpoint PATCH /system/jobs/{job_id} para efeito imediato, sem restart.
    """
    scheduler = get_scheduler()
    if not scheduler or not scheduler.get_job(job_id):
        return
    trigger = build_trigger(job_id, cfg)
    scheduler.reschedule_job(job_id, trigger=trigger)
    if cfg.get("enabled") is False:
        scheduler.pause_job(job_id)
    else:
        scheduler.resume_job(job_id)


# =============================================================================
# IMPLEMENTAÇÕES DOS JOBS
# =============================================================================

async def _send_summary_to_wpp_groups(db, target_date, agent_config: dict | None, tenant_id) -> None:
    """
    Envia, para cada grupo WhatsApp monitorado DESTE tenant, uma "ata" das
    próprias conversas do dia (não o resumo executivo agregado — esse é só para
    uso interno/dashboard). Usa a sessão WppConnect do próprio tenant.
    """
    from app.models.conversation import Conversation
    from app.models.tenant import TenantConfig
    from app.connectors.wppconnect_server import get_client_for_session
    from app.services.agent import get_expression_image, temperature_to_expression
    from app.services.analysis.group_digest import generate_group_daily_ata
    from sqlalchemy import select as _sel

    try:
        result = await db.execute(
            _sel(Conversation).where(
                Conversation.tenant_id == tenant_id,
                Conversation.is_monitored == True,  # noqa
                Conversation.wpp_group_id.isnot(None),
            )
        )
        groups = result.scalars().all()
        if not groups:
            logger.debug("wpp_send_summary_no_groups", tenant_id=str(tenant_id))
            return

        tc_result = await db.execute(_sel(TenantConfig).where(TenantConfig.tenant_id == tenant_id))
        tenant_cfg = tc_result.scalar_one_or_none()
        if not tenant_cfg:
            logger.warning("wpp_send_summary_no_tenant_config", tenant_id=str(tenant_id))
            return
        client = get_client_for_session(tenant_cfg.wpp_url, tenant_cfg.wpp_session, tenant_cfg.wpp_secret)

        token = await client.generate_token()

        for conv in groups:
            try:
                text, temperature_label = await generate_group_daily_ata(db, conv, target_date, agent_config)
                expr_type = temperature_to_expression(temperature_label)
                img_b64, img_mime = get_expression_image(agent_config, expr_type) if agent_config else (None, None)

                await client.send_text_message(token, conv.wpp_group_id, text)
                if img_b64:
                    ext = (img_mime or "image/png").split("/")[-1]
                    await client.send_file_base64(
                        token, conv.wpp_group_id, img_b64, img_mime or "image/png",
                        filename=f"expressao.{ext}", caption="",
                    )
                logger.info("wpp_summary_sent", group=conv.wpp_group_id, expr=expr_type, tenant_id=str(tenant_id))
            except Exception as e:
                logger.error("wpp_summary_send_failed", group=conv.wpp_group_id, error=str(e), tenant_id=str(tenant_id))
    except Exception as e:
        logger.error("wpp_send_summary_error", error=str(e), tenant_id=str(tenant_id))


async def run_daily_summary_job():
    """
    Gera e envia o resumo diário — UM POR TENANT, isolado (dados, agent_config
    e sessão WhatsApp cada um só enxerga/usa o que é da própria conta).
    """
    from app.db.session import AsyncSessionLocal
    from app.services.analysis.summarizer import summary_service
    from app.services.agent import get_agent_config
    from app.models.processing import ProcessingRun, RunType, RunStatus
    from app.models.conversation import Conversation
    from datetime import datetime, timezone, date, timedelta
    from sqlalchemy import select as _sel

    logger.info("daily_summary_job_started")
    async with AsyncSessionLocal() as db:
        run = ProcessingRun(
            run_type=RunType.SUMMARY,
            status=RunStatus.RUNNING,
            started_at=datetime.now(timezone.utc),
        )
        db.add(run)
        await db.flush()

        try:
            # Um resumo por tenant que tenha ao menos um grupo monitorado
            tenants_result = await db.execute(
                _sel(Conversation.tenant_id)
                .where(
                    Conversation.is_monitored == True,  # noqa
                    Conversation.tenant_id.isnot(None),
                )
                .distinct()
            )
            tenant_ids = [row[0] for row in tenants_result.all()]

            processed = 0
            yesterday = date.today() - timedelta(days=1)
            for tenant_id in tenant_ids:
                try:
                    agent_cfg = await get_agent_config(db, tenant_id)
                    summary = await summary_service.generate_daily_summary(
                        db, date.today(), agent_config=agent_cfg, tenant_id=tenant_id,
                    )
                    await db.commit()
                    processed += 1
                    logger.info("daily_summary_job_tenant_completed",
                                tenant_id=str(tenant_id), temperature=summary.temperature_score)

                    # Envia, por grupo, a ata das conversas de ONTEM (não o executivo
                    # agregado — esse fica só no dashboard interno). Ver D-030.
                    await _send_summary_to_wpp_groups(db, yesterday, agent_cfg, tenant_id)
                except Exception as e:
                    await db.rollback()
                    logger.error("daily_summary_job_tenant_failed", tenant_id=str(tenant_id), error=str(e))

            run.status = RunStatus.SUCCESS
            run.items_processed = processed
            run.finished_at = datetime.now(timezone.utc)
            await db.commit()
            logger.info("daily_summary_job_completed", tenants_processed=processed)

        except Exception as e:
            run.status = RunStatus.FAILED
            run.error_log = str(e)
            run.finished_at = datetime.now(timezone.utc)
            await db.commit()
            logger.error("daily_summary_job_failed", error=str(e))


async def run_alert_scan_job():
    """
    Varre follow-ups em atraso e gera alertas de SLA.
    No MVP, apenas loga — implementação completa na Fase 2.
    """
    from app.db.session import AsyncSessionLocal
    from app.models.followup import FollowUpItem, FollowUpStatus
    from app.models.alert import AlertEvent, AlertType, AlertSeverity, AlertStatus
    from datetime import datetime, timezone, timedelta
    from sqlalchemy import select, and_

    logger.debug("alert_scan_job_started")

    async with AsyncSessionLocal() as db:
        # Detecta follow-ups vencidos
        overdue_threshold = datetime.now(timezone.utc) - timedelta(
            hours=settings.FOLLOWUP_OVERDUE_HOURS
        )
        result = await db.execute(
            select(FollowUpItem).where(
                and_(
                    FollowUpItem.status == FollowUpStatus.PENDING,
                    FollowUpItem.detected_at <= overdue_threshold,
                )
            )
        )
        overdue_followups = result.scalars().all()

        for followup in overdue_followups:
            # Marca como atrasado
            followup.status = FollowUpStatus.OVERDUE

            # Cria alerta de follow-up em atraso
            alert = AlertEvent(
                conversation_id=followup.conversation_id,
                alert_type=AlertType.FOLLOWUP_DELAY,
                severity=AlertSeverity.MEDIUM,
                title=f"Follow-up em atraso: {followup.title[:100]}",
                description=f"Follow-up pendente há mais de {settings.FOLLOWUP_OVERDUE_HOURS}h sem resolução.",
                status=AlertStatus.OPEN,
                triggered_at=datetime.now(timezone.utc),
            )
            db.add(alert)

        if overdue_followups:
            await db.commit()
            logger.warning("followup_overdue_alerts_created", count=len(overdue_followups))

    # Enriquece alertas recentes com análise do Claude (se LLM_ENABLED)
    async with AsyncSessionLocal() as db:
        try:
            from app.services.analysis.claude_analyzer import enrich_open_alerts
            enriched = await enrich_open_alerts(db)
            if enriched:
                logger.info("alert_scan_claude_enriched", count=enriched)
        except Exception as e:
            logger.error("alert_scan_claude_failed", error=str(e))


async def run_metrics_update_job():
    """
    Atualiza métricas de grupos e colaboradores.
    MVP: log básico — implementação completa na Fase 2.
    """
    logger.debug("metrics_update_job_started")
    # TODO: Implementar cálculo de métricas por colaborador e grupo
    # Fase 2: calcular avg_response_time, quality_score, etc.


async def run_wpp_health_check_job():
    """
    Verifica se a sessão WppConnect está ativa.
    Se estiver CLOSED/desconectada, tenta reconectar automaticamente.
    """
    from app.connectors.wppconnect_server import wpp_client
    logger.debug("wpp_health_check_started")
    try:
        connected = await wpp_client.ensure_active()
        if connected:
            logger.debug("wpp_health_check_ok")
        else:
            logger.warning("wpp_health_check_needs_qr",
                           hint="Sessão iniciada mas aguardando QR scan")
    except Exception as e:
        logger.error("wpp_health_check_failed", error=str(e))


async def run_eod_briefing_job():
    """Gera o briefing de fim de dia às 18h — analisa o dia e distribui responsabilidades."""
    from app.db.session import AsyncSessionLocal
    from app.services.analysis.briefing import briefing_service

    logger.info("eod_briefing_job_started")
    async with AsyncSessionLocal() as db:
        try:
            summary = await briefing_service.generate_eod_briefing(db)
            await db.commit()
            logger.info("eod_briefing_job_done",
                        temperature=summary.temperature_score,
                        actions=len((summary.extra_data or {}).get("action_items", [])))
        except Exception as e:
            await db.rollback()
            logger.error("eod_briefing_job_failed", error=str(e))


async def run_cleanup_job():
    """
    Antes apagava mensagens mais antigas que DATA_RETENTION_DAYS (política LGPD).
    Decisão de produto (Gus, 2026-07-07): mensagens NUNCA são apagadas do banco —
    o limite de histórico por plano (max_history_days) já controla o que é
    importado/exibido; uma vez capturada, a mensagem fica permanentemente.
    Job mantido registrado (não removido, para não quebrar a tela de Automações
    do Sistema nem o toggle de jobs agendados), mas sem nenhum efeito destrutivo.
    """
    from app.db.session import AsyncSessionLocal
    from app.models.processing import ProcessingRun, RunType, RunStatus
    from datetime import datetime, timezone

    logger.info("cleanup_job_skipped_retention_disabled")

    async with AsyncSessionLocal() as db:
        run = ProcessingRun(
            run_type=RunType.CLEANUP,
            status=RunStatus.SUCCESS,
            started_at=datetime.now(timezone.utc),
            finished_at=datetime.now(timezone.utc),
            items_processed=0,
        )
        db.add(run)
        await db.commit()
