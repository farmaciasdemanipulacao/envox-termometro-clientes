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


def get_scheduler() -> AsyncIOScheduler | None:
    return _scheduler


def setup_scheduler() -> AsyncIOScheduler:
    global _scheduler

    _scheduler = AsyncIOScheduler(timezone="America/Sao_Paulo")

    # Job 1: Resumo diário — todo dia às SUMMARY_SCHEDULE_HOUR:00
    _scheduler.add_job(
        func=run_daily_summary_job,
        trigger=CronTrigger(
            hour=settings.SUMMARY_SCHEDULE_HOUR,
            minute=settings.SUMMARY_SCHEDULE_MINUTE,
        ),
        id="daily_summary",
        name="Geração de Resumo Diário",
        replace_existing=True,
        misfire_grace_time=300,  # 5 min de tolerância
    )

    # Job 2: Scan de alertas — a cada ALERT_SCAN_INTERVAL_MIN minutos
    _scheduler.add_job(
        func=run_alert_scan_job,
        trigger=IntervalTrigger(minutes=settings.ALERT_SCAN_INTERVAL_MIN),
        id="alert_scan",
        name="Scan de Alertas",
        replace_existing=True,
        misfire_grace_time=60,
    )

    # Job 3: Update de métricas — a cada 30 min
    _scheduler.add_job(
        func=run_metrics_update_job,
        trigger=IntervalTrigger(minutes=settings.METRICS_UPDATE_INTERVAL_MIN),
        id="metrics_update",
        name="Atualização de Métricas",
        replace_existing=True,
    )

    # Job 4 (novo): Health check WppConnect — a cada WPP_HEALTH_CHECK_INTERVAL_MIN minutos
    _scheduler.add_job(
        func=run_wpp_health_check_job,
        trigger=IntervalTrigger(minutes=settings.WPP_HEALTH_CHECK_INTERVAL_MIN),
        id="wpp_health_check",
        name="Health Check WppConnect",
        replace_existing=True,
        misfire_grace_time=60,
    )

    # Job 5: Briefing de fim de dia — todo dia às 18h (horário Brasília)
    _scheduler.add_job(
        func=run_eod_briefing_job,
        trigger=CronTrigger(hour=18, minute=0),
        id="eod_briefing",
        name="Briefing de Fim de Dia (18h)",
        replace_existing=True,
        misfire_grace_time=600,
    )

    # Job 6: Cleanup de dados antigos — todo domingo às 02:00
    _scheduler.add_job(
        func=run_cleanup_job,
        trigger=CronTrigger(day_of_week="sun", hour=2, minute=0),
        id="data_cleanup",
        name="Limpeza de Dados (LGPD)",
        replace_existing=True,
    )

    _scheduler.start()
    logger.info(
        "scheduler_started",
        jobs=[j.id for j in _scheduler.get_jobs()],
        summary_hour=settings.SUMMARY_SCHEDULE_HOUR,
        alert_scan_interval=settings.ALERT_SCAN_INTERVAL_MIN,
    )
    return _scheduler


# =============================================================================
# IMPLEMENTAÇÕES DOS JOBS
# =============================================================================

async def run_daily_summary_job():
    """Gera resumo diário da operação."""
    from app.db.session import AsyncSessionLocal
    from app.services.analysis.summarizer import summary_service
    from app.models.processing import ProcessingRun, RunType, RunStatus
    from datetime import datetime, timezone, date

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
            summary = await summary_service.generate_daily_summary(db, date.today())
            run.status = RunStatus.SUCCESS
            run.items_processed = 1
            run.finished_at = datetime.now(timezone.utc)
            await db.commit()
            logger.info("daily_summary_job_completed", temperature=summary.temperature_score)
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
    Remove dados antigos conforme política de retenção (LGPD).
    Mantém apenas os últimos DATA_RETENTION_DAYS dias.
    """
    from app.db.session import AsyncSessionLocal
    from app.models.message import Message
    from app.models.processing import ProcessingRun, RunType, RunStatus
    from datetime import datetime, timezone, timedelta
    from sqlalchemy import delete, and_

    logger.info("cleanup_job_started", retention_days=settings.DATA_RETENTION_DAYS)

    cutoff = datetime.now(timezone.utc) - timedelta(days=settings.DATA_RETENTION_DAYS)

    async with AsyncSessionLocal() as db:
        run = ProcessingRun(
            run_type=RunType.CLEANUP,
            status=RunStatus.RUNNING,
            started_at=datetime.now(timezone.utc),
        )
        db.add(run)
        await db.flush()

        try:
            result = await db.execute(
                delete(Message).where(Message.sent_at < cutoff)
            )
            deleted_count = result.rowcount
            run.status = RunStatus.SUCCESS
            run.items_processed = deleted_count
            run.finished_at = datetime.now(timezone.utc)
            await db.commit()
            logger.info("cleanup_job_completed", deleted_messages=deleted_count)
        except Exception as e:
            run.status = RunStatus.FAILED
            run.error_log = str(e)
            run.finished_at = datetime.now(timezone.utc)
            await db.commit()
            logger.error("cleanup_job_failed", error=str(e))
