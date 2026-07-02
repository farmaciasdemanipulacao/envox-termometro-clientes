"""
Serviço de geração de resumo diário.
Geração heurística por padrão; enriquecida por Claude Sonnet quando LLM_ENABLED=True.
"""
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.message import Message, SentimentLabel
from app.models.alert import AlertEvent, AlertStatus, AlertSeverity
from app.models.conversation import Conversation
from app.models.followup import FollowUpItem, FollowUpStatus
from app.models.summary import DailySummary, SummaryType, TemperatureLabel, GenerationMethod
from app.core.logging import get_logger

logger = get_logger(__name__)


class SummaryService:
    """
    Gera resumos diários da operação.
    Chamado pelo DailySummaryJob e pelo endpoint /summaries/generate.
    """

    async def generate_daily_summary(
        self,
        db: AsyncSession,
        target_date: Optional[date] = None,
        agent_config: Optional[dict] = None,
        tenant_id=None,
    ) -> DailySummary:
        """
        Gera o resumo do dia PARA UM TENANT (dados e resumo isolados por conta).
        Se já existe resumo para a data + tenant, sobrescreve.
        """
        if target_date is None:
            target_date = date.today()

        logger.info("generating_daily_summary", date=str(target_date), tenant_id=str(tenant_id) if tenant_id else None)

        # Coleta dados do dia (escopados ao tenant)
        stats = await self._collect_day_stats(db, target_date, tenant_id)

        # Gera texto executivo (LLM se habilitado, heurístico como fallback)
        executive_text = await self._generate_executive_text_llm(stats, target_date, agent_config)

        # Injeta identidade do agente
        if agent_config:
            from app.services.agent import inject_agent_identity
            temp_label = "critico" if stats.get("critical_alerts", 0) > 0 else \
                         "alerta" if stats.get("open_alerts", 0) > 2 else "saudavel"
            executive_text = inject_agent_identity(executive_text, agent_config, temp_label)

        # Calcula termômetro
        temperature_score, temperature_label = self._calculate_temperature(stats)

        # Verifica se já existe resumo para o dia (escopado ao tenant)
        existing = await db.execute(
            select(DailySummary).where(
                and_(
                    DailySummary.summary_date == target_date,
                    DailySummary.summary_type == SummaryType.GLOBAL,
                    DailySummary.conversation_id.is_(None),
                    DailySummary.tenant_id == tenant_id,
                )
            )
        )
        summary = existing.scalar_one_or_none()

        now = datetime.now(timezone.utc)

        gen_method = GenerationMethod.LLM if self._llm_available() else GenerationMethod.HEURISTIC

        if summary:
            # Atualiza existente
            for key, value in {
                "executive_text": executive_text,
                "highlights": stats["highlights"],
                "critical_points": stats["critical_points"],
                "opportunities": stats["opportunities"],
                "pending_followups": stats["pending_followups"],
                "recurring_themes": stats["themes"],
                "total_messages": stats["total_messages"],
                "total_participants": stats["total_participants"],
                "avg_sentiment_score": stats["avg_sentiment"],
                "risk_score_avg": stats["avg_risk"],
                "open_alerts_count": stats["open_alerts"],
                "critical_alerts_count": stats["critical_alerts"],
                "followups_pending": stats["followups_count"],
                "opportunities_count": stats["opportunities_count"],
                "avg_response_minutes": stats["avg_response_min"],
                "temperature_score": temperature_score,
                "temperature_label": temperature_label,
                "generated_at": now,
                "generation_method": gen_method,
            }.items():
                setattr(summary, key, value)
        else:
            summary = DailySummary(
                tenant_id=tenant_id,
                summary_date=target_date,
                summary_type=SummaryType.GLOBAL,
                executive_text=executive_text,
                highlights=stats["highlights"],
                critical_points=stats["critical_points"],
                opportunities=stats["opportunities"],
                pending_followups=stats["pending_followups"],
                recurring_themes=stats["themes"],
                total_messages=stats["total_messages"],
                total_participants=stats["total_participants"],
                avg_sentiment_score=stats["avg_sentiment"],
                risk_score_avg=stats["avg_risk"],
                open_alerts_count=stats["open_alerts"],
                critical_alerts_count=stats["critical_alerts"],
                followups_pending=stats["followups_count"],
                opportunities_count=stats["opportunities_count"],
                avg_response_minutes=stats["avg_response_min"],
                temperature_score=temperature_score,
                temperature_label=temperature_label,
                generated_at=now,
                generation_method=gen_method,
            )
            db.add(summary)

        await db.flush()
        logger.info("daily_summary_generated",
                    date=str(target_date),
                    temperature=temperature_score,
                    total_messages=stats["total_messages"])
        return summary

    async def _collect_day_stats(self, db: AsyncSession, target_date: date, tenant_id=None) -> dict:
        """
        Coleta estatísticas do dia para compor o resumo.
        Se `tenant_id` for informado, escopa tudo (mensagens/alertas/follow-ups) às
        conversas daquele tenant via join com Conversation — cada conta só vê seus
        próprios dados no resumo diário.
        """
        from datetime import timedelta

        start = datetime.combine(target_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        end = start + timedelta(days=1)

        def _scope_messages(q):
            if tenant_id is None:
                return q
            return q.join(Conversation, Message.conversation_id == Conversation.id).where(
                Conversation.tenant_id == tenant_id
            )

        def _scope_alerts(q):
            if tenant_id is None:
                return q
            return q.join(Conversation, AlertEvent.conversation_id == Conversation.id).where(
                Conversation.tenant_id == tenant_id
            )

        def _scope_followups(q):
            if tenant_id is None:
                return q
            return q.join(Conversation, FollowUpItem.conversation_id == Conversation.id).where(
                Conversation.tenant_id == tenant_id
            )

        # Total de mensagens do dia
        msg_result = await db.execute(
            _scope_messages(select(func.count(Message.id)).where(
                and_(Message.sent_at >= start, Message.sent_at < end)
            ))
        )
        total_messages = msg_result.scalar() or 0

        # Participantes únicos
        part_result = await db.execute(
            _scope_messages(select(func.count(func.distinct(Message.participant_id))).where(
                and_(Message.sent_at >= start, Message.sent_at < end)
            ))
        )
        total_participants = part_result.scalar() or 0

        # Sentimento médio
        sent_result = await db.execute(
            _scope_messages(select(func.avg(Message.sentiment_score)).where(
                and_(Message.sent_at >= start, Message.sent_at < end)
            ))
        )
        avg_sentiment = float(sent_result.scalar() or 0.0)

        # Risco médio
        risk_result = await db.execute(
            _scope_messages(select(func.avg(Message.risk_score)).where(
                and_(Message.sent_at >= start, Message.sent_at < end)
            ))
        )
        avg_risk = float(risk_result.scalar() or 0.0)

        # Alertas abertos
        alerts_result = await db.execute(
            _scope_alerts(select(func.count(AlertEvent.id)).where(
                and_(
                    AlertEvent.triggered_at >= start,
                    AlertEvent.triggered_at < end,
                    AlertEvent.status == AlertStatus.OPEN,
                )
            ))
        )
        open_alerts = alerts_result.scalar() or 0

        # Alertas críticos
        crit_alerts_result = await db.execute(
            _scope_alerts(select(func.count(AlertEvent.id)).where(
                and_(
                    AlertEvent.triggered_at >= start,
                    AlertEvent.triggered_at < end,
                    AlertEvent.severity == AlertSeverity.CRITICAL,
                )
            ))
        )
        critical_alerts = crit_alerts_result.scalar() or 0

        # Follow-ups pendentes
        followup_result = await db.execute(
            _scope_followups(select(func.count(FollowUpItem.id)).where(
                FollowUpItem.status == FollowUpStatus.PENDING
            ))
        )
        followups_count = followup_result.scalar() or 0

        # Oportunidades detectadas no dia
        opp_result = await db.execute(
            _scope_messages(select(func.count(Message.id)).where(
                and_(
                    Message.sent_at >= start,
                    Message.sent_at < end,
                    Message.is_opportunity == True,  # noqa
                )
            ))
        )
        opportunities_count = opp_result.scalar() or 0

        # Mensagens de churn
        churn_result = await db.execute(
            _scope_messages(select(func.count(Message.id)).where(
                and_(
                    Message.sent_at >= start,
                    Message.sent_at < end,
                    Message.is_churn_risk == True,  # noqa
                )
            ))
        )
        churn_count = churn_result.scalar() or 0

        # Mensagens de reclamação
        complaint_result = await db.execute(
            _scope_messages(select(func.count(Message.id)).where(
                and_(
                    Message.sent_at >= start,
                    Message.sent_at < end,
                    Message.is_complaint == True,  # noqa
                )
            ))
        )
        complaint_count = complaint_result.scalar() or 0

        # Gera highlights, críticos e oportunidades como listas de texto
        highlights = self._build_highlights(total_messages, avg_sentiment, open_alerts, opportunities_count)
        critical_points = self._build_critical_points(critical_alerts, churn_count, complaint_count, followups_count)
        opportunities = self._build_opportunities(opportunities_count)
        pending_followups_list = [f"{followups_count} follow-up(s) pendente(s) aguardando retorno"]
        themes = self._extract_themes(avg_sentiment, churn_count, complaint_count, opportunities_count)

        return {
            "total_messages": total_messages,
            "total_participants": total_participants,
            "avg_sentiment": avg_sentiment,
            "avg_risk": avg_risk,
            "open_alerts": open_alerts,
            "critical_alerts": critical_alerts,
            "followups_count": followups_count,
            "opportunities_count": opportunities_count,
            "churn_count": churn_count,
            "complaint_count": complaint_count,
            "avg_response_min": 0.0,  # TODO: calcular com timestamps de resposta
            "highlights": highlights,
            "critical_points": critical_points,
            "opportunities": opportunities,
            "pending_followups": pending_followups_list,
            "themes": themes,
        }

    def _generate_executive_text(self, stats: dict, target_date: date) -> str:
        """Gera texto narrativo do resumo executivo."""
        date_str = target_date.strftime("%d/%m/%Y")
        total = stats["total_messages"]
        sentiment = stats["avg_sentiment"]
        alerts = stats["open_alerts"]
        critical = stats["critical_alerts"]
        followups = stats["followups_count"]
        opportunities = stats["opportunities_count"]

        # Avaliação geral do clima
        if sentiment > 0.3:
            clima = "positivo"
        elif sentiment < -0.3:
            clima = "negativo"
        else:
            clima = "neutro"

        parts = [
            f"**Resumo Operacional — {date_str}**\n",
            f"Em {date_str}, foram processadas **{total} mensagens** na operação ENVOX.",
            f"O clima geral das conversas foi **{clima}** (score: {sentiment:.2f}).",
        ]

        if critical > 0:
            parts.append(f"⚠️ Foram identificados **{critical} alertas críticos** que requerem atenção imediata.")

        if alerts > 0:
            parts.append(f"Há **{alerts} alertas abertos** aguardando resolução.")

        if followups > 0:
            parts.append(f"**{followups} follow-ups** estão pendentes de retorno.")

        if opportunities > 0:
            parts.append(f"✅ **{opportunities} oportunidades comerciais** foram detectadas nas conversas.")

        churn = stats.get("churn_count", 0)
        if churn > 0:
            parts.append(f"🚨 **{churn} sinal(is) de risco de churn** foram identificados — ação imediata recomendada.")

        complaints = stats.get("complaint_count", 0)
        if complaints > 0:
            parts.append(f"Foram registradas **{complaints} mensagem(ns) com reclamações**.")

        if total == 0:
            parts = [f"**Resumo Operacional — {date_str}**\n",
                     "Nenhuma mensagem foi processada neste período."]

        return "\n\n".join(parts)

    def _calculate_temperature(self, stats: dict) -> tuple[int, TemperatureLabel]:
        """
        Calcula o termômetro de 0-100 da operação.
        100 = perfeito, 0 = crise total.
        """
        score = 100

        # Alertas críticos pesam muito
        score -= stats.get("critical_alerts", 0) * 15
        score -= stats.get("open_alerts", 0) * 3

        # Sentimento negativo
        if stats["avg_sentiment"] < 0:
            score += int(stats["avg_sentiment"] * 20)  # negativo = reduz

        # Risco médio alto
        score -= int(stats.get("avg_risk", 0) * 0.3)

        # Follow-ups em aberto
        score -= min(stats.get("followups_count", 0) * 2, 20)

        # Churn signals
        score -= stats.get("churn_count", 0) * 10

        score = max(0, min(100, score))

        if score >= 81:
            label = TemperatureLabel.EXCELLENT
        elif score >= 61:
            label = TemperatureLabel.GOOD
        elif score >= 41:
            label = TemperatureLabel.ATTENTION
        elif score >= 21:
            label = TemperatureLabel.WARNING
        else:
            label = TemperatureLabel.CRITICAL

        return score, label

    def _build_highlights(self, total: int, sentiment: float, alerts: int, opps: int) -> list:
        highlights = []
        if total > 0:
            highlights.append(f"{total} mensagens processadas na operação")
        if opps > 0:
            highlights.append(f"{opps} oportunidade(s) comercial(is) detectada(s)")
        if sentiment > 0.3:
            highlights.append("Clima geral positivo nas conversas")
        if alerts == 0 and total > 0:
            highlights.append("Nenhum alerta crítico no período")
        return highlights

    def _build_critical_points(self, critical_alerts: int, churn: int, complaints: int, followups: int) -> list:
        points = []
        if critical_alerts > 0:
            points.append(f"{critical_alerts} alerta(s) crítico(s) em aberto")
        if churn > 0:
            points.append(f"{churn} sinal(is) de risco de churn detectado(s)")
        if complaints > 0:
            points.append(f"{complaints} reclamação(ões) registrada(s)")
        if followups > 3:
            points.append(f"{followups} follow-ups pendentes — possível gargalo")
        return points

    def _build_opportunities(self, opps_count: int) -> list:
        if opps_count == 0:
            return []
        return [f"{opps_count} conversa(s) com sinal de oportunidade comercial identificada(s)"]

    def _extract_themes(self, sentiment: float, churn: int, complaints: int, opportunities: int) -> list:
        themes = []
        if churn > 0:
            themes.append("Risco de cancelamento")
        if complaints > 0:
            themes.append("Reclamações de clientes")
        if opportunities > 0:
            themes.append("Oportunidades comerciais")
        if sentiment < -0.2:
            themes.append("Insatisfação geral")
        elif sentiment > 0.3:
            themes.append("Satisfação e engajamento positivo")
        return themes

    def _llm_available(self) -> bool:
        import os
        from app.core.config import settings
        return settings.LLM_ENABLED and bool(os.getenv("ANTHROPIC_API_KEY", "").strip())

    async def _generate_executive_text_llm(self, stats: dict, target_date: date,
                                            agent_config: dict | None = None) -> str:
        """Gera texto executivo com Claude se disponível, senão usa heurística."""
        heuristic_text = self._generate_executive_text(stats, target_date)

        if not self._llm_available():
            return heuristic_text

        try:
            import asyncio
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None, self._call_claude_summary, stats, target_date, heuristic_text, agent_config
            )
            return result or heuristic_text
        except Exception as e:
            logger.warning("llm_summary_failed_fallback", error=str(e))
            return heuristic_text

    def _call_claude_summary(self, stats: dict, target_date: date, heuristic_text: str,
                             agent_config: dict | None = None) -> str | None:
        import os
        import anthropic
        from app.core.config import settings
        from app.services.agent import build_agent_personality_prompt

        api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
        client = anthropic.Anthropic(api_key=api_key)
        date_str = target_date.strftime("%d/%m/%Y")

        agent_context = build_agent_personality_prompt(agent_config) if agent_config else \
            "Você é um analista de operações."

        prompt = f"""{agent_context}
Gere um resumo executivo em português para o dia {date_str} com base nos dados abaixo.
Seja objetivo, direto. Use markdown com negrito nos pontos importantes.
Máximo 250 palavras.

DADOS DO DIA:
- Mensagens processadas: {stats['total_messages']}
- Participantes únicos: {stats['total_participants']}
- Score de sentimento médio: {stats['avg_sentiment']:.2f} (-1 negativo a +1 positivo)
- Score de risco médio: {stats['avg_risk']:.0f}/100
- Alertas abertos: {stats['open_alerts']}
- Alertas críticos: {stats['critical_alerts']}
- Riscos de churn detectados: {stats['churn_count']}
- Reclamações: {stats['complaint_count']}
- Oportunidades comerciais: {stats['opportunities_count']}
- Follow-ups pendentes: {stats['followups_count']}
- Temas recorrentes: {', '.join(stats['themes']) if stats['themes'] else 'nenhum'}

Rascunho heurístico (melhore este texto):
{heuristic_text}"""

        resp = client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=settings.LLM_SUMMARY_MAX_TOKENS,
            messages=[{"role": "user", "content": prompt}],
        )
        text = (resp.content[0].text or "").strip()
        logger.info("llm_summary_ok", chars=len(text), model=settings.ANTHROPIC_MODEL)
        return text


# Instância global
summary_service = SummaryService()
