"""
Transparência do sistema — lista tudo que roda automaticamente e não aparece
em nenhuma tela do produto (jobs agendados, thresholds, backfill, push, etc).
Rota restrita a administradores. Desde D-026, jobs/thresholds/regras de alerta
são editáveis (CRUD) por aqui, com efeito imediato no sistema rodando.
"""
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin_user
from app.core.config import settings
from app.core.scheduler import get_scheduler, JOB_SCHEDULE_TYPES, apply_job_runtime_config
from app.db.session import get_db
from app.models.automation import ScheduledJobConfig, SystemSetting, CustomAlertRule
from app.models.user import User
from app.schemas.automation import (
    JobConfigUpdate, SettingUpdate, AlertRuleResponse, AlertRuleCreate, AlertRuleUpdate,
)

router = APIRouter()

_DAYS_PT = {
    "mon": "seg", "tue": "ter", "wed": "qua", "thu": "qui",
    "fri": "sex", "sat": "sáb", "sun": "dom",
}

_JOB_DESCRIPTIONS = {
    "daily_summary": {
        "descricao": "Gera o resumo executivo diário da operação (heurístico ou via LLM) e envia automaticamente para o WhatsApp.",
        "envia_whatsapp": True,
        "detalhe": "Isolado por tenant desde 2026-07-01 (D-025): um resumo é gerado por conta, com os dados/agent_config/sessão WhatsApp da própria conta. Texto do resumo + imagem de expressão do Agente Virtual (conforme temperatura do dia) enviados apenas para os grupos monitorados daquele tenant.",
    },
    "alert_scan": {
        "descricao": "Detecta follow-ups pendentes vencidos (sem resposta há mais tempo que o limite) e cria alertas de SLA. Também enriquece alertas recentes com análise do Claude, se LLM_ENABLED estiver ativo.",
        "envia_whatsapp": False,
        "detalhe": None,
    },
    "metrics_update": {
        "descricao": "Reservado para recálculo de métricas de grupos/colaboradores.",
        "envia_whatsapp": False,
        "detalhe": "Ainda não implementado (placeholder/TODO no código) — hoje só loga, não calcula nada.",
    },
    "wpp_health_check": {
        "descricao": "Verifica se a sessão do WhatsApp (WppConnect) está ativa; tenta reconectar automaticamente se cair.",
        "envia_whatsapp": False,
        "detalhe": None,
    },
    "eod_briefing": {
        "descricao": "Gera um briefing de fim de dia (análise do dia + distribuição de responsabilidades).",
        "envia_whatsapp": False,
        "detalhe": "Diferente do resumo diário: fica só na plataforma, NÃO é enviado ao WhatsApp.",
    },
    "data_cleanup": {
        "descricao": "Antes apagava mensagens antigas por política de retenção (LGPD). Desativado por decisão do Gus (2026-07-07): mensagens nunca são apagadas do banco.",
        "envia_whatsapp": False,
        "detalhe": "Job mantido só para não quebrar o toggle/agendamento na tela — não executa nenhuma exclusão.",
    },
}

_SETTING_TO_ATTR = {
    "alert_risk_threshold": "ALERT_RISK_THRESHOLD",
    "alert_critical_threshold": "ALERT_CRITICAL_THRESHOLD",
    "alert_opportunity_threshold": "ALERT_OPPORTUNITY_THRESHOLD",
    "followup_overdue_hours": "FOLLOWUP_OVERDUE_HOURS",
    "sla_default_minutes": "SLA_DEFAULT_MINUTES",
    "data_retention_days": "DATA_RETENTION_DAYS",
}


def _describe_trigger(trigger) -> str:
    if isinstance(trigger, CronTrigger):
        fields = {f.name: str(f) for f in trigger.fields}
        hour = fields.get("hour", "*")
        hour = hour.zfill(2) if hour.isdigit() else hour
        minute = fields.get("minute", "0")
        minute = minute.zfill(2) if minute.isdigit() else minute
        dow = fields.get("day_of_week", "*")
        if dow and dow != "*":
            dias = ", ".join(_DAYS_PT.get(d.strip(), d.strip()) for d in dow.split(","))
            return f"toda(o) {dias} às {hour}:{minute}"
        return f"todo dia às {hour}:{minute}"
    if isinstance(trigger, IntervalTrigger):
        secs = trigger.interval.total_seconds()
        if secs % 3600 == 0:
            return f"a cada {int(secs // 3600)}h"
        return f"a cada {int(secs // 60)} min"
    return str(trigger)


@router.get("/system/automations")
async def get_system_automations(
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Mapa de tudo que o sistema faz sozinho — para dar transparência total ao admin."""
    scheduler = get_scheduler()
    job_configs = {
        r.job_id: r for r in (await db.execute(select(ScheduledJobConfig))).scalars().all()
    }

    jobs = []
    if scheduler:
        for job in scheduler.get_jobs():
            meta = _JOB_DESCRIPTIONS.get(job.id, {})
            cfg = job_configs.get(job.id)
            jobs.append({
                "id": job.id,
                "nome": job.name,
                "quando": _describe_trigger(job.trigger),
                "descricao": meta.get("descricao", ""),
                "envia_whatsapp": meta.get("envia_whatsapp", False),
                "detalhe": meta.get("detalhe"),
                "proxima_execucao": job.next_run_time.isoformat() if job.next_run_time else None,
                "editavel": {
                    "tipo": JOB_SCHEDULE_TYPES.get(job.id),
                    "hour": cfg.hour if cfg else None,
                    "minute": cfg.minute if cfg else None,
                    "day_of_week": cfg.day_of_week if cfg else None,
                    "interval_minutes": cfg.interval_minutes if cfg else None,
                },
                "enabled": cfg.enabled if cfg else True,
            })

    settings_rows = (await db.execute(select(SystemSetting))).scalars().all()
    settings_map = {s.key: s for s in settings_rows}
    rules = (await db.execute(select(CustomAlertRule).order_by(CustomAlertRule.created_at.desc()))).scalars().all()

    return {
        "jobs_agendados": jobs,
        "alertas": {
            "risco_alerta_threshold": settings.ALERT_RISK_THRESHOLD,
            "risco_critico_threshold": settings.ALERT_CRITICAL_THRESHOLD,
            "oportunidade_threshold": settings.ALERT_OPPORTUNITY_THRESHOLD,
            "followup_atraso_horas": settings.FOLLOWUP_OVERDUE_HOURS,
            "sla_resposta_minutos_padrao": settings.SLA_DEFAULT_MINUTES,
            "descricao": "Mensagem com risk_score acima do threshold vira alerta automaticamente; acima do threshold crítico dispara push notification imediato para todos os usuários do tenant.",
            "editavel": [
                {"key": k, "label": s.label, "value": s.value, "description": s.description}
                for k, s in settings_map.items() if k != "data_retention_days"
            ],
        },
        "heuristica_oportunidade": {
            "descricao": "Tag 'oportunidade_comercial' usa 2 camadas desde 2026-06-30: palavras-chave fortes (preço, orçamento, fechar contrato) disparam sozinhas; palavras-chave fracas/ambíguas (ex: 'aprovado', 'topei') só disparam a tag se houver termo de contexto comercial na própria mensagem OU nas últimas 5 mensagens da mesma conversa. Evita falso positivo (ex: cliente aprovando uma arte não vira 'oportunidade').",
        },
        "push_notifications": {
            "descricao": "Toda vez que uma mensagem gera alerta CRITICAL ou HIGH, o sistema dispara push notification automaticamente para todos os usuários ativos do tenant (via VAPID/service worker), sem nenhuma ação manual.",
        },
        "ativacao_de_grupo": {
            "descricao": "Ao ativar o monitoramento de um grupo ('Selecionar Grupos'), dois processos automáticos disparam em background, sem feedback em tela além de um toast inicial:",
            "itens": [
                "Backfill de histórico: busca mensagens antigas do WhatsApp e ingere no banco. Quantidade de dias é limitada pelo plano do tenant (max_history_days: Starter=90, Pro=180, Enterprise=ilimitado); se o usuário pedir mais dias do que o plano permite, o sistema reduz silenciosamente para o limite do plano.",
                "Perfilagem por IA: para cada participante externo com 3 ou mais mensagens no histórico importado, gera automaticamente um perfil (estilo de comunicação, engajamento, pontos de atenção) via LLM (Anthropic com fallback Groq).",
            ],
        },
        "retencao_dados": {
            "descricao": "Mensagens NÃO são mais apagadas automaticamente — decisão de manter todo o histórico permanentemente no banco (2026-07-07). O limite de histórico por plano (max_history_days) só controla o que é importado/exibido, não uma exclusão física.",
            "editavel": None,
        },
        "reconexao_whatsapp": {
            "descricao": "Se a sessão do WhatsApp cair, o sistema tenta reconectar sozinho a cada poucos minutos (WPP_AUTO_RECONNECT). Se precisar de um novo QR Code, fica só registrado em log — ninguém é avisado em tela até o usuário abrir a tela de Conexão WhatsApp.",
        },
        "regras_alerta_customizadas": [
            {
                "id": str(r.id), "nome": r.nome, "keywords": r.keywords,
                "severity": r.severity, "ativo": r.ativo,
            } for r in rules
        ],
        "limitacoes_conhecidas": [],
        "correcoes_recentes": [
            {
                "titulo": "Mensagens nunca mais são apagadas + relatórios usam TODO o período — 2026-07-07 (D-048)",
                "descricao": "(1) O job de limpeza LGPD (rodava todo domingo) apagava mensagens mais antigas que o período de retenção — desativado por decisão do Gus: o histórico fica permanente no banco. (2) Se alguém excluir uma mensagem 'para todos' no WhatsApp, o evento é ignorado e a mensagem original permanece gravada. (3) Resumo por Período e Análise Personalizada usavam uma amostra fixa de ~70-80 mensagens para gerar o texto da IA, mesmo quando o grupo tinha centenas/milhares no período — agora usam TODAS as mensagens do período (com resumo em blocos apenas se o volume estourar o contexto do LLM, nunca descartando silenciosamente).",
            },
            {
                "titulo": "Isolamento de tenant no resumo diário (06h) — corrigido em 2026-07-01 (D-025)",
                "descricao": "Antes, o resumo diário e seu envio automático ao WhatsApp misturavam dados de todos os tenants em um único resumo global e enviavam usando a sessão WhatsApp + configuração do Agente Virtual do admin, para os grupos monitorados de qualquer conta. Agora o job gera um resumo por tenant (dados só das conversas daquele tenant), usa o agent_config e a sessão WhatsApp do próprio tenant, e só envia para os grupos monitorados dele.",
            },
            {
                "titulo": "CRUD completo nas Automações do Sistema — 2026-07-01 (D-026)",
                "descricao": "Jobs agendados, thresholds de alerta/retenção e regras de alerta agora são editáveis direto nesta tela, com efeito imediato (sem precisar mexer em .env ou rebuildar o backend). Jobs podem ser editados/ativados/desativados (sem exclusão, para não quebrar funcionalidades centrais). Regras de alerta customizadas têm CRUD completo (criar, editar, excluir).",
            },
        ],
    }


# =============================================================================
# JOBS — editar horário/intervalo e ativar/desativar (sem criar/excluir)
# =============================================================================

@router.patch("/system/jobs/{job_id}")
async def update_job_config(
    job_id: str,
    payload: JobConfigUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    if job_id not in JOB_SCHEDULE_TYPES:
        raise HTTPException(404, "Job desconhecido")

    result = await db.execute(select(ScheduledJobConfig).where(ScheduledJobConfig.job_id == job_id))
    cfg = result.scalar_one_or_none()
    if not cfg:
        cfg = ScheduledJobConfig(job_id=job_id, enabled=True)
        db.add(cfg)

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(cfg, field, value)
    await db.commit()
    await db.refresh(cfg)

    apply_job_runtime_config(job_id, {
        "enabled": cfg.enabled, "hour": cfg.hour, "minute": cfg.minute,
        "day_of_week": cfg.day_of_week, "interval_minutes": cfg.interval_minutes,
    })

    return {
        "job_id": cfg.job_id, "enabled": cfg.enabled, "hour": cfg.hour,
        "minute": cfg.minute, "day_of_week": cfg.day_of_week,
        "interval_minutes": cfg.interval_minutes,
    }


# =============================================================================
# SETTINGS — thresholds e retenção, aplicados em memória imediatamente
# =============================================================================

@router.patch("/system/settings/{key}")
async def update_system_setting(
    key: str,
    payload: SettingUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    if key not in _SETTING_TO_ATTR:
        raise HTTPException(404, "Configuração desconhecida")

    result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
    setting = result.scalar_one_or_none()
    if not setting:
        raise HTTPException(404, "Configuração não encontrada")

    setting.value = payload.value
    await db.commit()

    setattr(settings, _SETTING_TO_ATTR[key], int(payload.value))

    return {"key": key, "value": setting.value}


# =============================================================================
# REGRAS DE ALERTA CUSTOMIZADAS — CRUD completo
# =============================================================================

def _rule_resp(r: CustomAlertRule) -> AlertRuleResponse:
    return AlertRuleResponse(
        id=str(r.id), nome=r.nome, keywords=r.keywords or [],
        severity=r.severity, ativo=r.ativo,
    )


@router.get("/system/alert-rules", response_model=list[AlertRuleResponse])
async def list_alert_rules(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    result = await db.execute(select(CustomAlertRule).order_by(CustomAlertRule.created_at.desc()))
    return [_rule_resp(r) for r in result.scalars().all()]


@router.post("/system/alert-rules", response_model=AlertRuleResponse, status_code=201)
async def create_alert_rule(
    payload: AlertRuleCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    rule = CustomAlertRule(
        nome=payload.nome,
        keywords=[k.strip().lower() for k in payload.keywords if k.strip()],
        severity=payload.severity,
        ativo=payload.ativo,
        created_by=admin.id,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return _rule_resp(rule)


@router.patch("/system/alert-rules/{rule_id}", response_model=AlertRuleResponse)
async def update_alert_rule(
    rule_id: str,
    payload: AlertRuleUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    rule = await db.get(CustomAlertRule, rule_id)
    if not rule:
        raise HTTPException(404, "Regra não encontrada")
    data = payload.model_dump(exclude_none=True)
    if "keywords" in data:
        data["keywords"] = [k.strip().lower() for k in data["keywords"] if k.strip()]
    for field, value in data.items():
        setattr(rule, field, value)
    await db.commit()
    await db.refresh(rule)
    return _rule_resp(rule)


@router.delete("/system/alert-rules/{rule_id}", status_code=204)
async def delete_alert_rule(
    rule_id: str,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    rule = await db.get(CustomAlertRule, rule_id)
    if not rule:
        raise HTTPException(404, "Regra não encontrada")
    await db.delete(rule)
    await db.commit()
