"""
Serviço de briefing de fim de dia — roda às 18h.
Analisa todas as conversas do dia, identifica pendências e distribui
responsabilidades pelos colaboradores internos.
"""
from datetime import date, datetime, timezone, timedelta
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.models.message import Message
from app.models.alert import AlertEvent, AlertStatus
from app.models.conversation import Conversation
from app.models.followup import FollowUpItem, FollowUpStatus
from app.models.participant import Participant, ParticipantRole
from app.models.summary import DailySummary, TemperatureLabel, GenerationMethod
from app.core.logging import get_logger

logger = get_logger(__name__)


class BriefingService:

    async def generate_eod_briefing(
        self,
        db: AsyncSession,
        target_date: Optional[date] = None,
    ) -> DailySummary:
        if target_date is None:
            target_date = date.today()

        logger.info("generating_eod_briefing", date=str(target_date))

        start = datetime.combine(target_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        end = start + timedelta(days=1)

        action_items = await self._collect_action_items(db, start, end)
        group_summary = await self._collect_group_summary(db, start, end)

        executive_text = self._generate_briefing_text(action_items, group_summary, target_date)
        highlights = [f"{len(action_items)} ação(ões) identificada(s) para o time"]
        critical_points = [i["title"] for i in action_items if i.get("priority") == "high"][:5]
        pending_fus = [i["title"] for i in action_items if i.get("type") == "followup"][:10]

        high_count = sum(1 for i in action_items if i.get("priority") == "high")
        temperature_score = max(0, min(100, 100 - high_count * 15 - len(action_items) * 2))
        if temperature_score >= 81:   label = TemperatureLabel.EXCELLENT
        elif temperature_score >= 61: label = TemperatureLabel.GOOD
        elif temperature_score >= 41: label = TemperatureLabel.ATTENTION
        elif temperature_score >= 21: label = TemperatureLabel.WARNING
        else:                         label = TemperatureLabel.CRITICAL

        now = datetime.now(timezone.utc)

        existing = await db.execute(
            select(DailySummary).where(
                and_(
                    DailySummary.summary_date == target_date,
                    DailySummary.summary_type == "briefing_eod",
                )
            )
        )
        summary = existing.scalar_one_or_none()

        extra_data = {"action_items": action_items, "group_summary": group_summary}

        if summary:
            summary.executive_text = executive_text
            summary.highlights = highlights
            summary.critical_points = critical_points
            summary.pending_followups = pending_fus
            summary.temperature_score = temperature_score
            summary.temperature_label = label
            summary.generated_at = now
            summary.extra_data = extra_data
        else:
            summary = DailySummary(
                summary_date=target_date,
                summary_type="briefing_eod",
                executive_text=executive_text,
                highlights=highlights,
                critical_points=critical_points,
                opportunities=[],
                pending_followups=pending_fus,
                recurring_themes=[],
                total_messages=0,
                total_participants=0,
                temperature_score=temperature_score,
                temperature_label=label,
                generated_at=now,
                generation_method=GenerationMethod.HEURISTIC,
                extra_data=extra_data,
            )
            db.add(summary)

        await db.flush()
        logger.info("eod_briefing_generated",
                    date=str(target_date),
                    actions=len(action_items),
                    temperature=temperature_score)
        return summary

    # ── coleta de dados ───────────────────────────────────────────

    async def _collect_action_items(self, db: AsyncSession, start, end) -> list[dict]:
        items: list[dict] = []

        # 1. Follow-ups pendentes/atrasados
        fu_rows = await db.execute(
            select(FollowUpItem, Conversation)
            .join(Conversation, FollowUpItem.conversation_id == Conversation.id)
            .where(FollowUpItem.status.in_([FollowUpStatus.PENDING, FollowUpStatus.OVERDUE]))
            .order_by(FollowUpItem.detected_at.desc())
            .limit(20)
        )
        for fu, conv in fu_rows.fetchall():
            assignee, assignee_id = await self._find_assignee(db, conv.id, start, end)
            priority = "high" if fu.status == FollowUpStatus.OVERDUE else "medium"
            items.append({
                "type": "followup",
                "group": conv.custom_name or conv.name,
                "group_id": str(conv.id),
                "title": fu.title or "Follow-up pendente",
                "description": (fu.description or "")[:120],
                "priority": priority,
                "assignee": assignee,
                "assignee_id": assignee_id,
            })

        # 2. Alertas abertos
        alert_rows = await db.execute(
            select(AlertEvent, Conversation)
            .join(Conversation, AlertEvent.conversation_id == Conversation.id)
            .where(AlertEvent.status == AlertStatus.OPEN)
            .order_by(AlertEvent.triggered_at.desc())
            .limit(15)
        )
        for alert, conv in alert_rows.fetchall():
            assignee, assignee_id = await self._find_assignee(db, conv.id, start, end)
            priority = "high" if alert.severity in ("critical", "high") else "medium"
            items.append({
                "type": "alert",
                "group": conv.custom_name or conv.name,
                "group_id": str(conv.id),
                "title": alert.title,
                "description": (alert.description or "")[:120],
                "priority": priority,
                "severity": alert.severity,
                "assignee": assignee,
                "assignee_id": assignee_id,
                "alert_type": alert.alert_type,
            })

        # 3. Riscos de churn detectados hoje (1 por grupo)
        churn_rows = await db.execute(
            select(Message, Conversation)
            .join(Conversation, Message.conversation_id == Conversation.id)
            .where(and_(
                Message.is_churn_risk == True,  # noqa
                Message.sent_at >= start,
                Message.sent_at < end,
            ))
            .order_by(Message.risk_score.desc())
            .limit(10)
        )
        seen: set[str] = set()
        for msg, conv in churn_rows.fetchall():
            gid = str(conv.id)
            if gid in seen:
                continue
            seen.add(gid)
            assignee, assignee_id = await self._find_assignee(db, conv.id, start, end)
            items.append({
                "type": "churn_risk",
                "group": conv.custom_name or conv.name,
                "group_id": gid,
                "title": f"Risco de churn — {conv.custom_name or conv.name}",
                "description": (msg.content or "")[:120],
                "priority": "high",
                "assignee": assignee,
                "assignee_id": assignee_id,
            })

        # Ordena: alta prioridade primeiro
        priority_order = {"high": 0, "medium": 1, "low": 2}
        items.sort(key=lambda x: priority_order.get(x.get("priority", "low"), 2))
        return items

    async def _find_assignee(self, db: AsyncSession, conv_id, start, end) -> tuple[str, str | None]:
        """
        Identifica o colaborador interno responsável pelo grupo.
        Ordem de preferência: gestor ativo hoje > colaborador ativo hoje > qualquer interno do grupo.
        """
        for role_filter, active_only in [
            (ParticipantRole.MANAGER, True),
            (None, True),
            (None, False),
        ]:
            filters = [
                Message.conversation_id == conv_id,
                Participant.is_internal == True,  # noqa
            ]
            if role_filter:
                filters.append(Participant.role == role_filter)
            if active_only:
                filters.extend([Message.sent_at >= start, Message.sent_at < end])

            row = await db.execute(
                select(Participant)
                .join(Message, Message.participant_id == Participant.id)
                .where(and_(*filters))
                .order_by(Message.sent_at.desc())
                .limit(1)
            )
            p = row.scalar_one_or_none()
            if p:
                return (p.custom_name or p.name, str(p.id))

        return ("Equipe ENVOX", None)

    async def _collect_group_summary(self, db: AsyncSession, start, end) -> list[dict]:
        rows = await db.execute(
            select(
                Conversation.id,
                Conversation.name,
                Conversation.custom_name,
                func.count(Message.id).label("msg_count"),
                func.avg(Message.risk_score).label("avg_risk"),
            )
            .join(Message, Message.conversation_id == Conversation.id)
            .where(and_(Message.sent_at >= start, Message.sent_at < end))
            .group_by(Conversation.id, Conversation.name, Conversation.custom_name)
            .order_by(func.avg(Message.risk_score).desc())
        )

        result = []
        for row in rows.fetchall():
            risk = float(row.avg_risk or 0)
            temperature = max(0, min(100, int(100 - risk)))

            alerts_r = await db.execute(
                select(func.count(AlertEvent.id)).where(
                    and_(AlertEvent.conversation_id == row.id, AlertEvent.status == AlertStatus.OPEN)
                )
            )
            fu_r = await db.execute(
                select(func.count(FollowUpItem.id)).where(
                    and_(
                        FollowUpItem.conversation_id == row.id,
                        FollowUpItem.status.in_([FollowUpStatus.PENDING, FollowUpStatus.OVERDUE]),
                    )
                )
            )
            assignee, _ = await self._find_assignee(db, row.id, start, end)
            result.append({
                "group": row.custom_name or row.name,
                "group_id": str(row.id),
                "messages": row.msg_count,
                "temperature": temperature,
                "alerts": alerts_r.scalar() or 0,
                "followups": fu_r.scalar() or 0,
                "responsible": assignee,
            })
        return result

    # ── geração de texto ──────────────────────────────────────────

    def _generate_briefing_text(self, action_items: list, group_summary: list, target_date: date) -> str:
        date_str = target_date.strftime("%d/%m/%Y")
        high = [i for i in action_items if i.get("priority") == "high"]
        medium = [i for i in action_items if i.get("priority") == "medium"]

        parts = [f"**Briefing de Fim de Dia — {date_str}**\n"]

        if not action_items:
            parts.append("✅ Nenhuma ação pendente identificada. Operação encerrou o dia sem pendências.")
            return "\n\n".join(parts)

        parts.append(
            f"Foram identificadas **{len(action_items)} ação(ões)** para encerramento do dia: "
            f"**{len(high)} prioritária(s)** e {len(medium)} de atenção média."
        )

        # Agrupa por responsável
        by_assignee: dict[str, list] = {}
        for item in action_items:
            by_assignee.setdefault(item.get("assignee", "Equipe ENVOX"), []).append(item)

        parts.append("\n**📋 Distribuição de Responsabilidades:**")
        for assignee, items in by_assignee.items():
            lines = [f"\n🔹 **{assignee}** ({len(items)} ação{'ões' if len(items) > 1 else ''}):"]
            for item in items[:6]:
                icon = "🔴" if item.get("priority") == "high" else "🟡"
                lines.append(f"  {icon} [{item['group']}] {item['title']}")
            if len(items) > 6:
                lines.append(f"  ... e mais {len(items) - 6} item(ns)")
            parts.append("\n".join(lines))

        # Grupos com atenção
        attention = [g for g in group_summary if g["temperature"] < 60 or g["alerts"] > 0 or g["followups"] > 0]
        if attention:
            parts.append("\n**📊 Grupos que precisam de atenção:**")
            for g in attention[:6]:
                icon = "🔴" if g["temperature"] < 40 else "🟡"
                line = f"  {icon} **{g['group']}** — temp. {g['temperature']}"
                if g["alerts"]:   line += f", {g['alerts']} alerta(s)"
                if g["followups"]: line += f", {g['followups']} follow-up(s)"
                line += f" → **{g['responsible']}**"
                parts.append(line)

        return "\n\n".join(parts)


briefing_service = BriefingService()
