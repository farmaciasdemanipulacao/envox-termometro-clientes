"""
Seeds de dados realistas para demonstração do ENVOX Intelligence.

Simula ~7 dias de atendimento de 10 grupos WhatsApp da ENVOX:
- 4 grupos de clientes (suporte, VIP, geral, implantação)
- 2 grupos internos (time de vendas, operações)
- 1 grupo de parceiros
- 3 grupos de projetos ativos

Inclui cenários realistas:
- Clientes satisfeitos e insatisfeitos
- Riscos de churn
- Oportunidades comerciais
- Follow-ups pendentes
- Promessas feitas e esquecidas
- Atrito interno
"""
import asyncio
import sys
import os
from datetime import datetime, timedelta, timezone
import random

# Adiciona o backend ao path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.core.config import settings
from app.db.session import engine, AsyncSessionLocal
from app.db.base import Base
from app.models.source import IngestionSource, SourceType
from app.models.conversation import Conversation, ConversationType
from app.models.participant import Participant, ParticipantRole
from app.models.message import Message, MessageType
from app.models.user import User
from app.core.security import hash_password, hash_api_key
from app.services.analysis.heuristics import heuristics_engine


# =============================================================================
# DADOS DE EXEMPLO
# =============================================================================

GROUPS = [
    {"id": "grp-suporte-geral", "name": "Suporte Geral ENVOX", "type": "group"},
    {"id": "grp-clientes-vip", "name": "Clientes VIP Premium", "type": "group"},
    {"id": "grp-implantacao", "name": "Implantação - Projeto Alpha", "type": "group"},
    {"id": "grp-financeiro", "name": "Financeiro & Contratos", "type": "group"},
    {"id": "grp-time-vendas", "name": "Time Comercial ENVOX", "type": "group"},
    {"id": "grp-operacoes", "name": "Operações Internas", "type": "group"},
    {"id": "grp-parceiros", "name": "Parceiros Estratégicos", "type": "group"},
    {"id": "grp-projeto-beta", "name": "Projeto Beta - Cliente XYZ", "type": "group"},
    {"id": "grp-novos-clientes", "name": "Onboarding Novos Clientes", "type": "group"},
    {"id": "grp-retencao", "name": "Retenção & Renovações", "type": "group"},
]

COLLABORATORS = [
    {"id": "col-001", "name": "Carlos Mendes", "role": "collaborator"},
    {"id": "col-002", "name": "Ana Rodrigues", "role": "collaborator"},
    {"id": "col-003", "name": "Felipe Costa", "role": "collaborator"},
    {"id": "col-004", "name": "Marina Silva", "role": "manager"},
    {"id": "col-005", "name": "Roberto Alves", "role": "collaborator"},
]

CUSTOMERS = [
    {"id": "cli-001", "name": "João Santos", "role": "customer"},
    {"id": "cli-002", "name": "Maria Fernanda Lima", "role": "customer"},
    {"id": "cli-003", "name": "Pedro Oliveira", "role": "customer"},
    {"id": "cli-004", "name": "Carla Souza", "role": "customer"},
    {"id": "cli-005", "name": "Lucas Martins", "role": "customer"},
    {"id": "cli-006", "name": "Beatriz Costa", "role": "customer"},
    {"id": "cli-007", "name": "Roberto Ferreira", "role": "customer"},
    {"id": "cli-008", "name": "Fernanda Gomes", "role": "customer"},
]

# Mensagens realistas por cenário
MESSAGES_SCENARIOS = [
    # Satisfação / Positivo
    ("cli", "positive", "Muito obrigada pela atenção de vocês! O sistema funcionou perfeitamente hoje."),
    ("cli", "positive", "Parabéns pelo atendimento! A equipe foi muito prestativa."),
    ("cli", "positive", "Resolveu rapidinho! Ótimo serviço, recomendo."),
    ("col", "positive", "Problema resolvido! Cliente ficou muito satisfeito com o atendimento."),

    # Neutro / Informativo
    ("cli", "neutral", "Bom dia! Podem me confirmar o horário da reunião amanhã?"),
    ("cli", "neutral", "Olá, quero saber o status da minha solicitação #4521"),
    ("col", "neutral", "Vou verificar e te retorno até o final do dia."),
    ("col", "neutral", "Bom dia! Segue o relatório de ontem em anexo."),
    ("cli", "neutral", "Tudo bem com vocês? Precisamos alinhar as entregas da semana."),

    # Reclamação / Negativo
    ("cli", "complaint", "Já é a terceira vez que o sistema cai! Isso é inadmissível."),
    ("cli", "complaint", "Estou esperando retorno há 3 dias e ninguém me responde!"),
    ("cli", "complaint", "Que situação péssima! Não consigo acessar o sistema desde ontem."),
    ("cli", "complaint", "Isso não está funcionando. Paguei caro por um serviço que não funciona!"),
    ("cli", "complaint", "Demora absurda! Urgente, preciso de solução agora!"),

    # Risco de churn
    ("cli", "churn", "Estou pensando seriamente em cancelar o contrato. Não estou satisfeito."),
    ("cli", "churn", "Vou procurar outra solução no mercado. Vocês não atendem minhas necessidades."),
    ("cli", "churn", "Quero cancelar. Podem me informar o processo de rescisão?"),
    ("cli", "churn", "Não quero mais este serviço. Estou indo para o concorrente."),

    # Oportunidade comercial
    ("cli", "opportunity", "Tenho interesse em contratar o módulo avançado. Podem me mandar uma proposta?"),
    ("cli", "opportunity", "Quero expandir para mais 5 usuários. Qual o valor?"),
    ("cli", "opportunity", "Vocês têm algum pacote enterprise? Estamos crescendo e precisamos de mais."),
    ("cli", "opportunity", "Me passa um orçamento para o plano anual, quero fechar logo."),
    ("cli", "opportunity", "Acabei de indicar vocês para um amigo. Ele vai entrar em contato."),

    # Promessa / Follow-up
    ("col", "promise", "Pode deixar, vou verificar isso agora e te retorno até às 18h."),
    ("col", "promise", "Certo! Vou providenciar e confirmo até amanhã de manhã."),
    ("col", "promise", "Perfeito! Farei isso hoje mesmo, pode contar comigo."),
    ("cli", "followup", "Você tinha me dito que retornaria até ontem. Cadê a resposta?"),
    ("cli", "followup", "Aguardando a confirmação que vocês prometeram. Já faz 2 dias."),

    # Urgência
    ("cli", "urgent", "URGENTE! O sistema está fora do ar e minha operação está parada!"),
    ("cli", "urgent", "Emergência! Não consigo acessar e tenho apresentação em 1 hora!"),
    ("cli", "urgent", "Preciso de suporte IMEDIATO. Produção parada!"),

    # Atrito interno
    ("col", "friction", "Isso foi passado para o time de implantação, mas ninguém me avisou."),
    ("col", "friction", "Já falei isso na última reunião e ficou jogando de um lado para o outro."),
    ("col", "friction", "Não é minha responsabilidade, isso era para ter sido resolvido pela equipe técnica."),
]


def random_timestamp(days_ago: int = 7) -> datetime:
    """Gera timestamp aleatório nos últimos N dias."""
    now = datetime.now(timezone.utc)
    seconds_ago = random.randint(0, days_ago * 24 * 3600)
    return now - timedelta(seconds=seconds_ago)


async def run_seeds():
    """Executa a carga de seeds no banco."""
    print("🌱 Iniciando carga de seeds ENVOX Intelligence...")
    print(f"   Banco: {settings.DATABASE_URL[:50]}...")

    # Garante que as tabelas existem
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        # 1. Cria IngestionSource de simulação
        from sqlalchemy import select
        source_result = await db.execute(
            select(IngestionSource).where(IngestionSource.name == "Simulator - Seed Data")
        )
        source = source_result.scalar_one_or_none()
        if not source:
            source = IngestionSource(
                name="Simulator - Seed Data",
                description="Dados simulados para demonstração do MVP",
                source_type=SourceType.SIMULATOR,
                api_key_hash=hash_api_key(settings.API_KEY_SECRET),
                is_active=True,
            )
            db.add(source)
            await db.flush()
            print(f"   ✅ IngestionSource criada: {source.name}")

        # 2. Cria usuário admin
        user_result = await db.execute(
            select(User).where(User.username == settings.ADMIN_USERNAME)
        )
        if not user_result.scalar_one_or_none():
            admin = User(
                username=settings.ADMIN_USERNAME,
                full_name="Dono - ENVOX",
                hashed_password=hash_password(settings.ADMIN_PASSWORD),
                is_active=True,
                is_admin=True,
            )
            db.add(admin)
            print(f"   ✅ Admin criado: {settings.ADMIN_USERNAME}")

        # 3. Cria participantes
        all_participants = {}
        for p_data in COLLABORATORS + CUSTOMERS:
            p_result = await db.execute(
                select(Participant).where(Participant.external_id == p_data["id"])
            )
            p = p_result.scalar_one_or_none()
            if not p:
                p = Participant(
                    external_id=p_data["id"],
                    name=p_data["name"],
                    role=p_data["role"],
                    is_internal=p_data["role"] in ("collaborator", "manager"),
                )
                db.add(p)
                await db.flush()
            all_participants[p_data["id"]] = p

        print(f"   ✅ {len(all_participants)} participantes criados/verificados")

        # 4. Cria conversas
        all_conversations = {}
        for g_data in GROUPS:
            c_result = await db.execute(
                select(Conversation).where(Conversation.external_id == g_data["id"])
            )
            c = c_result.scalar_one_or_none()
            if not c:
                c = Conversation(
                    source_id=source.id,
                    external_id=g_data["id"],
                    name=g_data["name"],
                    conversation_type=g_data.get("type", "group"),
                    sla_response_minutes=60,
                    participant_count=random.randint(3, 15),
                )
                db.add(c)
                await db.flush()
            all_conversations[g_data["id"]] = c

        print(f"   ✅ {len(all_conversations)} grupos/conversas criados/verificados")

        # 5. Gera mensagens realistas
        messages_created = 0
        for i in range(450):  # ~450 mensagens nos últimos 7 dias
            scenario = random.choice(MESSAGES_SCENARIOS)
            sender_type, scenario_type, content = scenario

            # Seleciona remetente
            if sender_type == "cli":
                p_data = random.choice(CUSTOMERS)
            else:
                p_data = random.choice(COLLABORATORS)

            participant = all_participants[p_data["id"]]

            # Seleciona grupo
            group_data = random.choice(GROUPS)
            conversation = all_conversations[group_data["id"]]

            sent_at = random_timestamp(7)

            # Analisa com heurísticas
            result = heuristics_engine.analyze(content, participant.role)

            message = Message(
                conversation_id=conversation.id,
                participant_id=participant.id,
                source_id=source.id,
                external_id=f"seed-msg-{i:04d}",
                content=content,
                message_type=MessageType.TEXT,
                sent_at=sent_at,
                ingested_at=datetime.now(timezone.utc),
                processed_at=datetime.now(timezone.utc),
                sentiment=result.sentiment,
                sentiment_score=result.sentiment_score,
                risk_score=result.risk_score,
                opportunity_score=result.opportunity_score,
                urgency_level=result.urgency_level,
                is_followup_needed=result.is_followup_needed,
                is_promise_detected=result.is_promise_detected,
                is_complaint=result.is_complaint,
                is_escalation=result.is_escalation,
                is_opportunity=result.is_opportunity,
                is_internal_friction=result.is_internal_friction,
                is_churn_risk=result.is_churn_risk,
                tags=result.tags,
            )
            db.add(message)
            messages_created += 1

        await db.flush()
        print(f"   ✅ {messages_created} mensagens geradas com análise heurística")

        # 6. Gera resumo de hoje
        from app.services.analysis.summarizer import summary_service
        from datetime import date
        summary = await summary_service.generate_daily_summary(db, date.today())
        print(f"   ✅ Resumo diário gerado — Termômetro: {summary.temperature_score}/100 ({summary.temperature_label})")

        await db.commit()
        print("\n✅ Seeds carregados com sucesso!")
        print(f"\n📊 Acesse o dashboard em: http://localhost:8000")
        print(f"📚 Documentação da API: http://localhost:8000/docs")
        print(f"\n🔑 Login: {settings.ADMIN_USERNAME} / {settings.ADMIN_PASSWORD}")
        print(f"🔑 API Key (ingestão): {settings.API_KEY_SECRET}")


if __name__ == "__main__":
    asyncio.run(run_seeds())
