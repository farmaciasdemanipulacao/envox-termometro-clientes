"""Refinamentos do diagnóstico Secovi-PR baseados em feedbacks reais de operação.

Este módulo mantém a pesquisa com ~19 perguntas, mas aumenta a capacidade causal:
- diferencia mudança de briefing x falha em executar a mesma orientação;
- captura retrabalho repetido e impacto em outras demandas;
- mede aderência a briefing/referência, não só qualidade estética final.
"""
from copy import deepcopy
from collections import Counter
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.voice import (
    VoiceClient, VoiceSurveyAnswer, VoiceSurveyCampaign, VoiceSurveyQuestion,
    VoiceSurveyRespondent, VoiceSurveyTemplate, VoiceSurveyVersion,
)
from app.schemas.voice import VoiceBootstrapSecovi
from app.api.routes.voice import SECOVI_QUESTIONS, _now, _owned_campaign

router = APIRouter(prefix="/voice")


def _refined_questions():
    questions = deepcopy(SECOVI_QUESTIONS)
    by_key = {q["key"]: q for q in questions}

    # Q6 — atraso não é só data final: retrabalho pode bloquear outras entregas.
    by_key["deadline_delivery"]["followup_json"] = {
        "operator": "lte",
        "value": 6,
        "prompt": "Que atraso mais impactou sua área? Alguma outra demanda ou projeto ficou parado enquanto aguardava entrega/correção? Se sim, conte qual.",
    }

    # Q8 — inclui aderência ao briefing como falha distinta de estética/técnica.
    opts = by_key["delivery_problem_types"]["options_json"]
    if "Não aderência ao briefing/referência enviada" not in opts:
        opts.insert(-1, "Não aderência ao briefing/referência enviada")

    # Q10 — ponto central do novo feedback: causa do retrabalho.
    by_key["correction_resolution"].update({
        "question_type": "single_choice",
        "prompt": "Quando uma entrega precisou de correção ou retrabalho, qual situação mais se aproxima do que normalmente aconteceu?",
        "options_json": [
            "A correção resolveu corretamente na primeira tentativa",
            "Foram necessárias novas tentativas para executar a mesma orientação já passada",
            "O pedido/briefing mudou entre uma versão e outra",
            "Aconteceram os dois cenários: mudança de pedido e falha na execução da orientação",
            "A correção demorou ou o material não retornou adequadamente",
            "Não tive esse tipo de situação",
        ],
        "dimension": "qualidade",
        "weight": 1.3,
        "scoring_json": {
            "strategy": "map",
            "map": {
                "a correção resolveu corretamente na primeira tentativa": 90,
                "foram necessárias novas tentativas para executar a mesma orientação já passada": 25,
                "o pedido/briefing mudou entre uma versão e outra": 65,
                "aconteceram os dois cenários: mudança de pedido e falha na execução da orientação": 35,
                "a correção demorou ou o material não retornou adequadamente": 20,
                "não tive esse tipo de situação": 80,
            },
        },
        "followup_json": {
            "values": [
                "Foram necessárias novas tentativas para executar a mesma orientação já passada",
                "O pedido/briefing mudou entre uma versão e outra",
                "Aconteceram os dois cenários: mudança de pedido e falha na execução da orientação",
                "A correção demorou ou o material não retornou adequadamente",
            ],
            "prompt": "Descreva um exemplo. Se a orientação já havia sido desenhada, escrita ou enviada como referência, informe isso; se o pedido mudou, explique em que momento mudou.",
        },
    })

    # Q14 — entendimento inclui capacidade de traduzir referência concreta em execução.
    by_key["business_understanding"]["followup_json"] = {
        "operator": "lte",
        "value": 6,
        "prompt": "O que a Envox precisa entender melhor? Considere também situações em que uma referência, esboço ou orientação objetiva não foi refletida corretamente na entrega.",
    }

    # Q16 — prioridade específica para aderência ao briefing.
    rank_opts = by_key["improvement_ranking"]["options_json"]
    if "Aderência ao briefing/orientações e referências" not in rank_opts:
        rank_opts.insert(4, "Aderência ao briefing/orientações e referências")

    # Q18 — captura custo oculto do retrabalho sem criar uma 20ª pergunta.
    by_key["expected_not_delivered"]["prompt"] = (
        "Existe alguma demanda, iniciativa ou entrega que você esperava da Envox e considera que não aconteceu? "
        "Descreva mesmo que ela nunca tenha sido formalmente solicitada. Se algum projeto ficou parado porque outra entrega estava em correção/retrabalho, registre também esse impacto."
    )

    return questions


SECOVI_QUESTIONS_REFINED = _refined_questions()


@router.post("/bootstrap/secovi-refined", status_code=201)
async def bootstrap_secovi_refined(
    payload: VoiceBootstrapSecovi,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cria a versão recomendada para o primeiro ciclo Secovi-PR."""
    client = (await db.execute(select(VoiceClient).where(
        VoiceClient.owner_user_id == current_user.id,
        VoiceClient.slug == "secovi-pr",
    ))).scalar_one_or_none()
    if not client:
        client = VoiceClient(
            owner_user_id=current_user.id,
            name="Secovi-PR",
            slug="secovi-pr",
            legal_name="Secovi-PR",
            metadata_json={"first_voice_client": True},
        )
        db.add(client)
        await db.flush()

    template_name = "Pesquisa de Percepção e Qualidade da Parceria"
    template = (await db.execute(select(VoiceSurveyTemplate).where(
        VoiceSurveyTemplate.client_id == client.id,
        VoiceSurveyTemplate.name == template_name,
    ))).scalar_one_or_none()
    if not template:
        template = VoiceSurveyTemplate(
            client_id=client.id,
            name=template_name,
            description="Diagnóstico causal de atendimento, prazo, qualidade, aderência ao briefing, proatividade, confiança e demandas perdidas.",
        )
        db.add(template)
        await db.flush()

    max_ver = await db.scalar(select(func.max(VoiceSurveyVersion.version_number)).where(
        VoiceSurveyVersion.template_id == template.id
    ))
    version = VoiceSurveyVersion(
        template_id=template.id,
        version_number=(max_ver or 0) + 1,
        status="published",
        title="Pesquisa confidencial de percepção e qualidade da parceria",
        intro_text=(
            "Queremos entender com profundidade como sua área percebe a parceria com a Envox. "
            "O objetivo é separar problemas de fluxo, execução, prazo, retrabalho, comunicação e expectativas para definir ações concretas."
        ),
        confidentiality_text=(
            "Esta pesquisa é confidencial e o link é individual. As respostas serão analisadas prioritariamente de forma consolidada. "
            "O acesso à identificação individual é restrito à liderança autorizada da Envox responsável pelo diagnóstico e pelo plano de ação."
        ),
        settings_json={
            "estimated_minutes": 10,
            "client": "Secovi-PR",
            "anonymous": False,
            "diagnostic_version": "secovi-refined-2026-08-31",
            "causal_separation": [
                "mudanca_de_briefing",
                "falha_execucao_mesma_orientacao",
                "retrabalho_repetido",
                "impacto_em_outras_demandas",
            ],
        },
        published_at=_now(),
        created_by=current_user.id,
    )
    db.add(version)
    await db.flush()

    for question in SECOVI_QUESTIONS_REFINED:
        db.add(VoiceSurveyQuestion(version_id=version.id, **question))

    campaign = VoiceSurveyCampaign(
        client_id=client.id,
        version_id=version.id,
        name=payload.campaign_name,
        status="active",
        public_base_url=payload.public_base_url,
        created_by=current_user.id,
        settings_json={
            "confidential": True,
            "anonymous": False,
            "recommended_bootstrap": True,
        },
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)

    return {
        "client_id": str(client.id),
        "template_id": str(template.id),
        "version_id": str(version.id),
        "campaign_id": str(campaign.id),
        "questions": len(SECOVI_QUESTIONS_REFINED),
        "diagnostic_version": "secovi-refined-2026-08-31",
        "next_step": "Importe os respondentes e use esta campanha como o primeiro ciclo Secovi-PR.",
    }


@router.get("/campaigns/{campaign_id}/secovi-causal-analysis")
async def secovi_causal_analysis(
    campaign_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Camada causal para separar culpa de execução x mudança de pedido."""
    campaign = await _owned_campaign(db, current_user, campaign_id)
    question = (await db.execute(select(VoiceSurveyQuestion).where(
        VoiceSurveyQuestion.version_id == campaign.version_id,
        VoiceSurveyQuestion.key == "correction_resolution",
    ))).scalar_one_or_none()
    if not question:
        raise HTTPException(404, "A campanha não possui a pergunta causal de correção/retrabalho")

    completed_ids = (await db.execute(select(VoiceSurveyRespondent.id).where(
        VoiceSurveyRespondent.campaign_id == campaign_id,
        VoiceSurveyRespondent.status == "completed",
    ))).scalars().all()
    if not completed_ids:
        return {"campaign_id": str(campaign_id), "completed": 0, "correction_patterns": [], "interpretation": []}

    answers = (await db.execute(select(VoiceSurveyAnswer).where(
        VoiceSurveyAnswer.respondent_id.in_(completed_ids),
        VoiceSurveyAnswer.question_id == question.id,
    ))).scalars().all()

    patterns = Counter(str(a.value_json) for a in answers)
    comments = [a.comment for a in answers if a.comment]
    same_instruction = patterns.get("Foram necessárias novas tentativas para executar a mesma orientação já passada", 0)
    changed_briefing = patterns.get("O pedido/briefing mudou entre uma versão e outra", 0)
    mixed = patterns.get("Aconteceram os dois cenários: mudança de pedido e falha na execução da orientação", 0)
    not_returned = patterns.get("A correção demorou ou o material não retornou adequadamente", 0)

    interpretation = []
    if same_instruction + mixed:
        interpretation.append({
            "signal": "execution_gap",
            "count": same_instruction + mixed,
            "meaning": "Há evidência de retrabalho porque uma orientação já fornecida não foi executada adequadamente em tentativas subsequentes.",
        })
    if changed_briefing + mixed:
        interpretation.append({
            "signal": "briefing_changed",
            "count": changed_briefing + mixed,
            "meaning": "Parte do retrabalho também pode decorrer de mudanças do próprio pedido/briefing; não deve ser atribuída automaticamente à execução da Envox.",
        })
    if not_returned:
        interpretation.append({
            "signal": "correction_flow_failure",
            "count": not_returned,
            "meaning": "Há indicação de quebra no fluxo de correção: demora excessiva ou material que não retornou adequadamente.",
        })

    return {
        "campaign_id": str(campaign_id),
        "completed": len(completed_ids),
        "correction_patterns": [{"pattern": k, "count": v} for k, v in patterns.most_common()],
        "interpretation": interpretation,
        "qualitative_evidence": comments[:100],
        "note": "Este diagnóstico separa mudança de escopo/briefing de falha em executar a mesma orientação, evitando conclusões causais indevidas.",
    }
