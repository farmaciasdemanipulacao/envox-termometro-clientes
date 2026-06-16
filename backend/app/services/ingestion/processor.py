"""
Pipeline de ingestão de mensagens.
Recebe payload normalizado, valida, persiste e dispara análise.
"""
from datetime import datetime, timezone
from typing import Optional
import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.message import Message, MessageType, SentimentLabel, UrgencyLevel
from app.models.conversation import Conversation, ConversationType
from app.models.participant import Participant, ParticipantRole
from app.models.source import IngestionSource
from app.models.alert import AlertEvent, AlertType, AlertSeverity, AlertStatus
from app.models.followup import FollowUpItem, FollowUpStatus
from app.services.analysis.heuristics import heuristics_engine
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class IngestionProcessor:
    """
    Orquestra o pipeline completo de ingestão:
    1. Recebe payload normalizado
    2. Resolve/cria Conversation e Participant
    3. Persiste Message
    4. Aplica análise heurística
    5. Gera AlertEvents se necessário
    6. Cria FollowUpItems se necessário
    """

    async def process_message(
        self,
        db: AsyncSession,
        payload: dict,
        source: IngestionSource,
    ) -> Message:
        """
        Processa uma única mensagem.

        Payload esperado (normalizado pelo conector):
        {
            "conversation_external_id": "grupo-xyz",
            "conversation_name": "Clientes VIP",
            "participant_external_id": "5511999991234",
            "participant_name": "João Silva",
            "participant_role": "customer",  # customer|collaborator|manager
            "content": "Quero cancelar meu contrato",
            "message_type": "text",
            "sent_at": "2024-06-16T10:30:00Z",
            "external_id": "msg-001",  # ID na origem
            "raw_payload": {...}  # Payload original (opcional)
        }
        """
        # 1. Resolver conversa
        conversation = await self._get_or_create_conversation(
            db,
            external_id=payload.get("conversation_external_id"),
            name=payload.get("conversation_name", "Conversa sem nome"),
            source=source,
            conv_type=payload.get("conversation_type", ConversationType.GROUP),
        )

        # 2. Resolver participante
        participant = await self._get_or_create_participant(
            db,
            external_id=payload.get("participant_external_id"),
            name=payload.get("participant_name", "Desconhecido"),
            role=payload.get("participant_role", ParticipantRole.UNKNOWN),
        )

        # 3. Parse do timestamp
        sent_at = self._parse_timestamp(payload.get("sent_at"))

        # 4. Criar a mensagem
        message = Message(
            conversation_id=conversation.id,
            participant_id=participant.id if participant else None,
            source_id=source.id,
            external_id=payload.get("external_id"),
            content=payload.get("content", ""),
            message_type=payload.get("message_type", MessageType.TEXT),
            sent_at=sent_at,
            ingested_at=datetime.now(timezone.utc),
            raw_payload=payload.get("raw_payload"),
        )
        db.add(message)
        await db.flush()  # Para ter o ID antes da análise

        # 5. Análise heurística
        result = heuristics_engine.analyze(
            text=message.content,
            participant_role=participant.role if participant else "unknown",
        )

        # 6. Atualizar campos de análise na mensagem
        message.sentiment = result.sentiment
        message.sentiment_score = result.sentiment_score
        message.risk_score = result.risk_score
        message.opportunity_score = result.opportunity_score
        message.urgency_level = result.urgency_level
        message.is_followup_needed = result.is_followup_needed
        message.is_promise_detected = result.is_promise_detected
        message.is_complaint = result.is_complaint
        message.is_escalation = result.is_escalation
        message.is_opportunity = result.is_opportunity
        message.is_internal_friction = result.is_internal_friction
        message.is_churn_risk = result.is_churn_risk
        message.tags = result.tags
        message.processed_at = datetime.now(timezone.utc)

        # 7. Gerar alertas se necessário
        await self._check_and_create_alerts(db, message, conversation, participant, result)

        # 8. Criar follow-up se necessário
        if result.is_followup_needed or result.is_promise_detected:
            await self._create_followup(db, message, conversation, participant)

        logger.info(
            "message_processed",
            message_id=str(message.id),
            conversation=conversation.name,
            risk_score=result.risk_score,
            sentiment=result.sentiment,
            tags=result.tags,
        )

        return message

    async def process_batch(
        self,
        db: AsyncSession,
        payloads: list[dict],
        source: IngestionSource,
    ) -> list[Message]:
        """Processa uma lista de mensagens em lote."""
        messages = []
        errors = 0

        for payload in payloads:
            try:
                msg = await self.process_message(db, payload, source)
                messages.append(msg)
            except Exception as e:
                errors += 1
                logger.error("message_processing_failed", error=str(e), payload=payload)

        logger.info(
            "batch_processed",
            total=len(payloads),
            success=len(messages),
            errors=errors,
        )
        return messages

    # =========================================================================
    # HELPERS PRIVADOS
    # =========================================================================

    async def _get_or_create_conversation(
        self,
        db: AsyncSession,
        external_id: Optional[str],
        name: str,
        source: IngestionSource,
        conv_type: str = ConversationType.GROUP,
    ) -> Conversation:
        """Busca conversa existente ou cria nova."""
        if external_id:
            result = await db.execute(
                select(Conversation).where(
                    Conversation.external_id == external_id,
                    Conversation.source_id == source.id,
                )
            )
            conv = result.scalar_one_or_none()
            if conv:
                return conv

        conv = Conversation(
            source_id=source.id,
            external_id=external_id,
            name=name,
            conversation_type=conv_type,
            sla_response_minutes=settings.SLA_DEFAULT_MINUTES,
        )
        db.add(conv)
        await db.flush()
        return conv

    async def _get_or_create_participant(
        self,
        db: AsyncSession,
        external_id: Optional[str],
        name: str,
        role: str = ParticipantRole.UNKNOWN,
    ) -> Optional[Participant]:
        """Busca participante existente ou cria novo."""
        if external_id:
            result = await db.execute(
                select(Participant).where(Participant.external_id == external_id)
            )
            participant = result.scalar_one_or_none()
            if participant:
                return participant

        participant = Participant(
            external_id=external_id,
            name=name,
            role=role,
            is_internal=role in (ParticipantRole.COLLABORATOR, ParticipantRole.MANAGER),
        )
        db.add(participant)
        await db.flush()
        return participant

    def _parse_timestamp(self, ts: Optional[str]) -> datetime:
        """Parse de timestamp ISO ou usa now()."""
        if not ts:
            return datetime.now(timezone.utc)
        try:
            if isinstance(ts, datetime):
                return ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            return dt
        except (ValueError, AttributeError):
            return datetime.now(timezone.utc)

    async def _check_and_create_alerts(
        self,
        db: AsyncSession,
        message: Message,
        conversation: Conversation,
        participant: Optional[Participant],
        result,
    ) -> None:
        """Verifica limites e cria AlertEvents quando necessário."""
        alerts_to_create = []

        # Alerta de churn — máxima prioridade
        if result.is_churn_risk:
            alerts_to_create.append(AlertEvent(
                conversation_id=conversation.id,
                message_id=message.id,
                participant_id=participant.id if participant else None,
                alert_type=AlertType.CHURN_RISK,
                severity=AlertSeverity.CRITICAL,
                title=f"⚠️ Risco de Churn: {conversation.name}",
                description=f"Cliente sinalizou possível cancelamento em '{conversation.name}'.",
                excerpt=message.content[:300],
                status=AlertStatus.OPEN,
                triggered_at=datetime.now(timezone.utc),
            ))

        # Alerta de escalada
        elif result.is_escalation:
            alerts_to_create.append(AlertEvent(
                conversation_id=conversation.id,
                message_id=message.id,
                participant_id=participant.id if participant else None,
                alert_type=AlertType.ESCALATION,
                severity=AlertSeverity.HIGH,
                title=f"🔥 Escalada emocional: {conversation.name}",
                description="Detectada escalada de tensão na conversa.",
                excerpt=message.content[:300],
                status=AlertStatus.OPEN,
                triggered_at=datetime.now(timezone.utc),
            ))

        # Alerta de risco alto (sem ser churn)
        elif result.risk_score >= settings.ALERT_CRITICAL_THRESHOLD:
            alerts_to_create.append(AlertEvent(
                conversation_id=conversation.id,
                message_id=message.id,
                participant_id=participant.id if participant else None,
                alert_type=AlertType.RISK,
                severity=AlertSeverity.HIGH,
                title=f"Alto risco detectado: {conversation.name}",
                description=f"Score de risco {result.risk_score}/100 na conversa.",
                excerpt=message.content[:300],
                status=AlertStatus.OPEN,
                triggered_at=datetime.now(timezone.utc),
            ))

        elif result.risk_score >= settings.ALERT_RISK_THRESHOLD:
            alerts_to_create.append(AlertEvent(
                conversation_id=conversation.id,
                message_id=message.id,
                participant_id=participant.id if participant else None,
                alert_type=AlertType.RISK,
                severity=AlertSeverity.MEDIUM,
                title=f"Risco moderado: {conversation.name}",
                description=f"Score de risco {result.risk_score}/100.",
                excerpt=message.content[:300],
                status=AlertStatus.OPEN,
                triggered_at=datetime.now(timezone.utc),
            ))

        # Alerta de oportunidade
        if result.is_opportunity and result.opportunity_score >= settings.ALERT_OPPORTUNITY_THRESHOLD:
            alerts_to_create.append(AlertEvent(
                conversation_id=conversation.id,
                message_id=message.id,
                participant_id=participant.id if participant else None,
                alert_type=AlertType.OPPORTUNITY,
                severity=AlertSeverity.LOW,
                title=f"💡 Oportunidade: {conversation.name}",
                description="Sinal de oportunidade comercial detectado.",
                excerpt=message.content[:300],
                status=AlertStatus.OPEN,
                triggered_at=datetime.now(timezone.utc),
            ))

        for alert in alerts_to_create:
            db.add(alert)

    async def _create_followup(
        self,
        db: AsyncSession,
        message: Message,
        conversation: Conversation,
        participant: Optional[Participant],
    ) -> None:
        """Cria um FollowUpItem para acompanhamento."""
        followup = FollowUpItem(
            conversation_id=conversation.id,
            message_id=message.id,
            assigned_to_id=None,  # Sem atribuição automática no MVP
            title=f"Follow-up pendente: {conversation.name}",
            description=f"Mensagem requer retorno: '{message.content[:200]}'",
            status=FollowUpStatus.PENDING,
            detected_at=datetime.now(timezone.utc),
        )
        db.add(followup)


# Instância global
ingestion_processor = IngestionProcessor()
