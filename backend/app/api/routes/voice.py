"""API do módulo Voz do Cliente — pesquisas de percepção confidenciais e identificadas por token."""
import csv
import io
import re
from collections import Counter
from datetime import datetime, timezone
from typing import Any
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
from app.schemas.voice import (
    VoiceAnswerBatch, VoiceBootstrapSecovi, VoiceCampaignCreate, VoiceClientCreate,
    VoiceCsvImport, VoiceQuestionCreate, VoiceRespondentBatchCreate,
    VoiceTemplateCreate, VoiceVersionCreate,
)
from app.services.voice_scoring import (
    build_recommendations, calculate_respondent_score, consolidate_matrix,
    count_answer_values,
)

router = APIRouter(prefix="/voice")


def _now():
    return datetime.now(timezone.utc)


def _slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-") or "cliente"


def _public_url(campaign: VoiceSurveyCampaign, respondent: VoiceSurveyRespondent) -> str:
    return f"{campaign.public_base_url.rstrip('/')}/?t={respondent.access_token}"


async def _owned_client(db: AsyncSession, user: User, client_id: UUID) -> VoiceClient:
    q = select(VoiceClient).where(VoiceClient.id == client_id, VoiceClient.owner_user_id == user.id)
    obj = (await db.execute(q)).scalar_one_or_none()
    if not obj:
        raise HTTPException(404, "Cliente não encontrado")
    return obj


async def _owned_campaign(db: AsyncSession, user: User, campaign_id: UUID) -> VoiceSurveyCampaign:
    q = (
        select(VoiceSurveyCampaign)
        .join(VoiceClient, VoiceClient.id == VoiceSurveyCampaign.client_id)
        .where(VoiceSurveyCampaign.id == campaign_id, VoiceClient.owner_user_id == user.id)
    )
    obj = (await db.execute(q)).scalar_one_or_none()
    if not obj:
        raise HTTPException(404, "Campanha não encontrada")
    return obj


async def _public_context(db: AsyncSession, token: str):
    respondent = (await db.execute(
        select(VoiceSurveyRespondent).where(VoiceSurveyRespondent.access_token == token)
    )).scalar_one_or_none()
    if not respondent:
        raise HTTPException(404, "Link de pesquisa inválido")

    campaign = await db.get(VoiceSurveyCampaign, respondent.campaign_id)
    if not campaign or campaign.status not in {"active", "closed"}:
        raise HTTPException(410, "Esta pesquisa não está disponível")

    version = await db.get(VoiceSurveyVersion, campaign.version_id)
    client = await db.get(VoiceClient, campaign.client_id)
    questions = (await db.execute(
        select(VoiceSurveyQuestion)
        .where(VoiceSurveyQuestion.version_id == campaign.version_id)
        .order_by(VoiceSurveyQuestion.position.asc())
    )).scalars().all()
    return respondent, campaign, version, client, questions


def _question_payload(q: VoiceSurveyQuestion):
    return {
        "id": str(q.id), "key": q.key, "position": q.position, "section": q.section,
        "type": q.question_type, "prompt": q.prompt, "help_text": q.help_text,
        "required": q.is_required, "options": q.options_json or [],
        "condition": q.condition_json or {}, "followup": q.followup_json or {},
    }


def _condition_met(condition: dict, values: dict[str, Any]) -> bool:
    if not condition:
        return True
    key = condition.get("question_key")
    op = condition.get("operator", "eq")
    expected = condition.get("value")
    actual = values.get(key)
    if op == "eq": return actual == expected
    if op == "neq": return actual != expected
    if op == "lte":
        try: return float(actual) <= float(expected)
        except (TypeError, ValueError): return False
    if op == "gte":
        try: return float(actual) >= float(expected)
        except (TypeError, ValueError): return False
    if op == "in": return actual in (expected or [])
    if op == "contains": return expected in (actual or []) if isinstance(actual, list) else False
    if op == "truthy": return bool(actual)
    return True


@router.get("/clients")
async def list_clients(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(VoiceClient).where(VoiceClient.owner_user_id == current_user.id).order_by(VoiceClient.name)
    )).scalars().all()
    return [{"id": str(x.id), "name": x.name, "slug": x.slug, "active": x.is_active} for x in rows]


@router.post("/clients", status_code=201)
async def create_client(payload: VoiceClientCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    slug = _slugify(payload.slug or payload.name)
    exists = (await db.execute(select(VoiceClient).where(
        VoiceClient.owner_user_id == current_user.id, VoiceClient.slug == slug
    ))).scalar_one_or_none()
    if exists: raise HTTPException(409, "Já existe um cliente com este slug")
    obj = VoiceClient(owner_user_id=current_user.id, name=payload.name.strip(), slug=slug, legal_name=payload.legal_name, metadata_json=payload.metadata_json)
    db.add(obj); await db.commit(); await db.refresh(obj)
    return {"id": str(obj.id), "name": obj.name, "slug": obj.slug}


@router.post("/clients/{client_id}/templates", status_code=201)
async def create_template(client_id: UUID, payload: VoiceTemplateCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _owned_client(db, current_user, client_id)
    obj = VoiceSurveyTemplate(client_id=client_id, name=payload.name, description=payload.description)
    db.add(obj); await db.commit(); await db.refresh(obj)
    return {"id": str(obj.id), "name": obj.name}


@router.post("/templates/{template_id}/versions", status_code=201)
async def create_version(template_id: UUID, payload: VoiceVersionCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    template = await db.get(VoiceSurveyTemplate, template_id)
    if not template: raise HTTPException(404, "Modelo não encontrado")
    await _owned_client(db, current_user, template.client_id)
    max_ver = await db.scalar(select(func.max(VoiceSurveyVersion.version_number)).where(VoiceSurveyVersion.template_id == template_id))
    obj = VoiceSurveyVersion(
        template_id=template_id, version_number=(max_ver or 0) + 1, status="draft", title=payload.title,
        intro_text=payload.intro_text,
        confidentiality_text=payload.confidentiality_text or "Pesquisa confidencial de percepção e qualidade da parceria. As respostas serão analisadas de forma consolidada e a identificação individual terá acesso restrito.",
        settings_json=payload.settings_json, created_by=current_user.id,
    )
    db.add(obj); await db.commit(); await db.refresh(obj)
    return {"id": str(obj.id), "version": obj.version_number, "status": obj.status}


@router.post("/versions/{version_id}/questions", status_code=201)
async def add_question(version_id: UUID, payload: VoiceQuestionCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    version = await db.get(VoiceSurveyVersion, version_id)
    if not version: raise HTTPException(404, "Versão não encontrada")
    template = await db.get(VoiceSurveyTemplate, version.template_id)
    await _owned_client(db, current_user, template.client_id)
    if version.status != "draft": raise HTTPException(409, "Somente versões em rascunho podem ser alteradas")
    obj = VoiceSurveyQuestion(version_id=version_id, **payload.model_dump())
    db.add(obj)
    try: await db.commit()
    except Exception:
        await db.rollback(); raise HTTPException(409, "Chave ou posição de pergunta duplicada")
    await db.refresh(obj)
    return {"id": str(obj.id), "key": obj.key, "position": obj.position}


@router.post("/versions/{version_id}/publish")
async def publish_version(version_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    version = await db.get(VoiceSurveyVersion, version_id)
    if not version: raise HTTPException(404, "Versão não encontrada")
    template = await db.get(VoiceSurveyTemplate, version.template_id)
    await _owned_client(db, current_user, template.client_id)
    count = await db.scalar(select(func.count(VoiceSurveyQuestion.id)).where(VoiceSurveyQuestion.version_id == version_id))
    if not count: raise HTTPException(409, "A versão não possui perguntas")
    version.status = "published"; version.published_at = _now(); await db.commit()
    return {"id": str(version.id), "status": version.status, "questions": count}


@router.get("/campaigns")
async def list_campaigns(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(VoiceSurveyCampaign, VoiceClient).join(VoiceClient, VoiceClient.id == VoiceSurveyCampaign.client_id)
        .where(VoiceClient.owner_user_id == current_user.id).order_by(VoiceSurveyCampaign.created_at.desc())
    )).all()
    return [{"id": str(c.id), "name": c.name, "client_id": str(cl.id), "client": cl.name, "status": c.status, "version_id": str(c.version_id), "public_base_url": c.public_base_url} for c, cl in rows]


@router.post("/campaigns", status_code=201)
async def create_campaign(payload: VoiceCampaignCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _owned_client(db, current_user, payload.client_id)
    version = await db.get(VoiceSurveyVersion, payload.version_id)
    if not version: raise HTTPException(404, "Versão não encontrada")
    template = await db.get(VoiceSurveyTemplate, version.template_id)
    if template.client_id != payload.client_id: raise HTTPException(409, "A versão não pertence a este cliente")
    if version.status != "published": raise HTTPException(409, "Publique a versão antes de abrir uma campanha")
    obj = VoiceSurveyCampaign(**payload.model_dump(), created_by=current_user.id)
    db.add(obj); await db.commit(); await db.refresh(obj)
    return {"id": str(obj.id), "name": obj.name, "status": obj.status}


@router.post("/campaigns/{campaign_id}/respondents", status_code=201)
async def add_respondents(campaign_id: UUID, payload: VoiceRespondentBatchCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    campaign = await _owned_campaign(db, current_user, campaign_id)
    created = []
    for item in payload.respondents:
        r = VoiceSurveyRespondent(campaign_id=campaign_id, **item.model_dump())
        db.add(r); await db.flush()
        created.append({"id": str(r.id), "name": r.name, "token": r.access_token, "url": _public_url(campaign, r)})
    await db.commit()
    return {"created": len(created), "respondents": created}


@router.post("/campaigns/{campaign_id}/respondents/import-csv", status_code=201)
async def import_respondents_csv(campaign_id: UUID, payload: VoiceCsvImport, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    campaign = await _owned_campaign(db, current_user, campaign_id)
    reader = csv.DictReader(io.StringIO(payload.csv_text))
    created, errors = [], []
    aliases = {
        "name": ["nome", "name"], "whatsapp": ["whatsapp", "telefone", "celular"],
        "role_function": ["cargo", "funcao", "função", "role"], "sector": ["setor", "area", "área"],
        "unit": ["unidade", "unit"], "regional": ["regional"], "external_ref": ["id", "codigo", "código", "external_ref"],
    }
    for idx, raw in enumerate(reader, start=2):
        normalized = {str(k).strip().lower(): (v.strip() if isinstance(v, str) else v) for k, v in raw.items() if k}
        def pick(field):
            for alias in aliases[field]:
                if normalized.get(alias): return normalized[alias]
            return None
        name = pick("name")
        if not name:
            errors.append({"line": idx, "error": "nome obrigatório"}); continue
        r = VoiceSurveyRespondent(campaign_id=campaign_id, name=name, whatsapp=pick("whatsapp"), role_function=pick("role_function"), sector=pick("sector"), unit=pick("unit"), regional=pick("regional"), external_ref=pick("external_ref"))
        db.add(r); await db.flush(); created.append({"id": str(r.id), "name": r.name, "url": _public_url(campaign, r)})
    await db.commit()
    return {"created": len(created), "errors": errors, "respondents": created}


@router.get("/campaigns/{campaign_id}/respondents")
async def list_respondents(campaign_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    campaign = await _owned_campaign(db, current_user, campaign_id)
    rows = (await db.execute(select(VoiceSurveyRespondent).where(VoiceSurveyRespondent.campaign_id == campaign_id).order_by(VoiceSurveyRespondent.name))).scalars().all()
    return [{
        "id": str(r.id), "name": r.name, "whatsapp": r.whatsapp, "role_function": r.role_function,
        "sector": r.sector, "unit": r.unit, "regional": r.regional, "status": r.status,
        "sent_at": r.sent_at, "first_opened_at": r.first_opened_at, "started_at": r.started_at, "completed_at": r.completed_at,
        "perception_score": r.perception_score, "risk_score": r.risk_score, "classification": r.health_classification,
        "url": _public_url(campaign, r),
    } for r in rows]


@router.post("/respondents/{respondent_id}/mark-sent")
async def mark_sent(respondent_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.get(VoiceSurveyRespondent, respondent_id)
    if not r: raise HTTPException(404, "Respondente não encontrado")
    await _owned_campaign(db, current_user, r.campaign_id)
    r.sent_at = r.sent_at or _now()
    if r.status == "pending": r.status = "sent"
    await db.commit()
    return {"id": str(r.id), "status": r.status, "sent_at": r.sent_at}


@router.get("/public/{token}")
async def open_public_survey(token: str, db: AsyncSession = Depends(get_db)):
    respondent, campaign, version, client, questions = await _public_context(db, token)
    now = _now(); respondent.first_opened_at = respondent.first_opened_at or now; respondent.last_opened_at = now
    if respondent.status in {"pending", "sent"}: respondent.status = "opened"
    await db.commit()
    answer_rows = (await db.execute(
        select(VoiceSurveyAnswer, VoiceSurveyQuestion).join(VoiceSurveyQuestion, VoiceSurveyQuestion.id == VoiceSurveyAnswer.question_id)
        .where(VoiceSurveyAnswer.respondent_id == respondent.id)
    )).all()
    answers = {q.key: {"value": a.value_json, "comment": a.comment} for a, q in answer_rows}
    return {
        "campaign": {"name": campaign.name, "status": campaign.status}, "client": {"name": client.name},
        "survey": {"title": version.title, "intro_text": version.intro_text, "confidentiality_text": version.confidentiality_text},
        "respondent": {"name": respondent.name, "role_function": respondent.role_function, "sector": respondent.sector, "unit": respondent.unit, "regional": respondent.regional, "status": respondent.status},
        "questions": [_question_payload(q) for q in questions], "answers": answers,
    }


@router.post("/public/{token}/answers")
async def save_public_answers(token: str, payload: VoiceAnswerBatch, db: AsyncSession = Depends(get_db)):
    respondent, campaign, version, client, questions = await _public_context(db, token)
    if respondent.status == "completed": raise HTTPException(409, "Pesquisa já concluída")
    by_key = {q.key: q for q in questions}
    for incoming in payload.answers:
        q = by_key.get(incoming.question_key)
        if not q: raise HTTPException(422, f"Pergunta desconhecida: {incoming.question_key}")
        existing = (await db.execute(select(VoiceSurveyAnswer).where(VoiceSurveyAnswer.respondent_id == respondent.id, VoiceSurveyAnswer.question_id == q.id))).scalar_one_or_none()
        if existing:
            existing.value_json = incoming.value; existing.comment = incoming.comment
        else:
            db.add(VoiceSurveyAnswer(respondent_id=respondent.id, question_id=q.id, value_json=incoming.value, comment=incoming.comment))
    respondent.started_at = respondent.started_at or _now(); respondent.status = "started"
    await db.commit(); return {"saved": len(payload.answers), "status": respondent.status}


@router.post("/public/{token}/complete")
async def complete_public_survey(token: str, db: AsyncSession = Depends(get_db)):
    respondent, campaign, version, client, questions = await _public_context(db, token)
    answers = (await db.execute(select(VoiceSurveyAnswer).where(VoiceSurveyAnswer.respondent_id == respondent.id))).scalars().all()
    q_by_id = {q.id: q for q in questions}; answer_by_id = {a.question_id: a for a in answers}
    values_by_key = {q_by_id[a.question_id].key: a.value_json for a in answers if a.question_id in q_by_id}
    missing = []
    for q in questions:
        if q.is_required and _condition_met(q.condition_json or {}, values_by_key):
            answer = answer_by_id.get(q.id)
            if not answer or answer.value_json in (None, "", []): missing.append(q.key)
    if missing: raise HTTPException(422, {"message": "Responda as perguntas obrigatórias", "missing": missing})
    perception, risk, classification, dims, flags = calculate_respondent_score(questions, answer_by_id)
    respondent.perception_score = perception; respondent.risk_score = risk; respondent.health_classification = classification
    respondent.dimension_scores_json = dims; respondent.scoring_flags_json = flags; respondent.completed_at = _now(); respondent.status = "completed"
    await db.commit(); return {"status": "completed", "message": "Obrigado. Sua percepção foi registrada com sucesso."}


@router.get("/campaigns/{campaign_id}/dashboard")
async def campaign_dashboard(campaign_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _owned_campaign(db, current_user, campaign_id)
    respondents = (await db.execute(select(VoiceSurveyRespondent).where(VoiceSurveyRespondent.campaign_id == campaign_id))).scalars().all()
    statuses = Counter(r.status for r in respondents); completed = [r for r in respondents if r.status == "completed"]
    avg_score = round(sum(r.perception_score or 0 for r in completed) / len(completed), 1) if completed else None
    avg_risk = round(sum(r.risk_score or 0 for r in completed) / len(completed), 1) if completed else None
    classes = Counter(r.health_classification for r in completed)
    return {"respondents": len(respondents), "statuses": dict(statuses), "completion_rate": round((len(completed) / len(respondents) * 100), 1) if respondents else 0, "average_perception_score": avg_score, "average_risk": avg_risk, "classifications": dict(classes), "matrix": consolidate_matrix(completed)}


@router.get("/campaigns/{campaign_id}/analysis")
async def campaign_analysis(campaign_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    campaign = await _owned_campaign(db, current_user, campaign_id)
    respondents = (await db.execute(select(VoiceSurveyRespondent).where(VoiceSurveyRespondent.campaign_id == campaign_id, VoiceSurveyRespondent.status == "completed"))).scalars().all()
    questions = (await db.execute(select(VoiceSurveyQuestion).where(VoiceSurveyQuestion.version_id == campaign.version_id))).scalars().all()
    respondent_ids = [r.id for r in respondents]
    answers = []
    if respondent_ids:
        answers = (await db.execute(select(VoiceSurveyAnswer).where(VoiceSurveyAnswer.respondent_id.in_(respondent_ids)))).scalars().all()
    counters, open_text = count_answer_values(questions, answers); matrix = consolidate_matrix(respondents)
    problem_types = counters.get("delivery_problem_types", Counter()).most_common(); reasons_left = counters.get("left_request_reasons", Counter()).most_common(); improvements = counters.get("improvement_ranking", Counter()).most_common()
    demands = open_text.get("expected_not_delivered", []); left_details = open_text.get("left_to_request__comments", [])
    low_trust = [r for r in respondents if (r.dimension_scores_json or {}).get("confianca", 100) < 55]
    return {
        "campaign_id": str(campaign.id), "completed": len(respondents), "matrix": matrix,
        "main_causes": {
            "delivery_problem_types": [{"cause": k, "count": v} for k, v in problem_types[:10]],
            "reasons_work_stopped_reaching_envox": [{"cause": k, "count": v} for k, v in reasons_left[:10]],
            "improvement_priorities": [{"cause": k, "count": v} for k, v in improvements[:10]],
        },
        "critical_segments": [row for row in matrix if (row.get("risk") or 0) >= 55][:10],
        "invisible_or_lost_demands": {"expected_but_not_delivered": demands[:50], "details_from_people_who_stopped_requesting": left_details[:50], "respondents_who_stopped_requesting": sum(1 for r in respondents if (r.scoring_flags_json or {}).get("left_to_request"))},
        "confidence": {"low_confidence_respondents": len(low_trust), "average": round(sum((r.dimension_scores_json or {}).get("confianca", 0) for r in respondents) / len(respondents), 1) if respondents else None},
        "alerts": [{"type": "respondent_critical", "respondent_id": str(r.id), "name": r.name, "unit": r.unit, "sector": r.sector, "regional": r.regional, "risk": r.risk_score, "score": r.perception_score} for r in respondents if r.health_classification == "Crítico"],
        "recommended_actions": build_recommendations(respondents),
    }


SECOVI_QUESTIONS = [
    dict(key="overall_partnership", position=1, section="Percepção geral", question_type="scale_0_10", prompt="De 0 a 10, como você avalia hoje a parceria da sua área com a Envox?", dimension="atendimento", weight=1.2, scoring_json={"strategy":"scale","min":0,"max":10}, followup_json={"operator":"lte","value":6,"prompt":"O que mais pesou para essa nota?"}),
    dict(key="scope_clarity", position=2, section="Entendimento e fluxo", question_type="single_choice", prompt="Quão claro está para você o que pode ser solicitado à Envox dentro da parceria atual?", options_json=["Muito claro","Claro","Parcialmente claro","Pouco claro","Nada claro"], dimension="entendimento", scoring_json={"strategy":"map","map":{"muito claro":100,"claro":80,"parcialmente claro":60,"pouco claro":35,"nada claro":10}}),
    dict(key="demand_frequency", position=3, section="Entendimento e fluxo", question_type="single_choice", prompt="Com que frequência sua área costuma ter demandas que poderiam envolver a Envox?", options_json=["Diariamente","Semanalmente","Quinzenalmente","Mensalmente","Raramente"]),
    dict(key="channel_clarity", position=4, section="Entendimento e fluxo", question_type="single_choice", prompt="Você sabe claramente qual é o canal correto para solicitar uma demanda e garantir que ela entre no fluxo da Envox?", options_json=["Sim, totalmente","Na maioria das vezes","Tenho dúvidas","Não"], dimension="atendimento", scoring_json={"strategy":"map","map":{"sim, totalmente":100,"na maioria das vezes":75,"tenho dúvidas":40,"não":10}}, followup_json={"values":["Tenho dúvidas","Não"],"prompt":"Onde costuma surgir a dúvida ou quebra de fluxo?"}),
    dict(key="initial_response", position=5, section="Atendimento", question_type="scale_0_10", prompt="De 0 a 10, como você avalia a qualidade do retorno inicial da Envox quando uma demanda é solicitada?", dimension="atendimento", scoring_json={"strategy":"scale","min":0,"max":10}, followup_json={"operator":"lte","value":6,"prompt":"O que faltou nesse primeiro retorno?"}),
    dict(key="deadline_delivery", position=6, section="Prazo", question_type="scale_0_10", prompt="De 0 a 10, como você avalia o cumprimento dos prazos combinados?", dimension="prazo", weight=1.2, scoring_json={"strategy":"scale","min":0,"max":10}, followup_json={"operator":"lte","value":6,"prompt":"Que tipo de atraso mais impactou sua área?"}),
    dict(key="final_quality", position=7, section="Qualidade", question_type="scale_0_10", prompt="De 0 a 10, como você avalia a qualidade final das entregas recebidas?", dimension="qualidade", weight=1.3, scoring_json={"strategy":"scale","min":0,"max":10}, followup_json={"operator":"lte","value":6,"prompt":"Descreva o principal problema de qualidade percebido."}),
    dict(key="delivery_problem_types", position=8, section="Qualidade", question_type="multi_choice", prompt="Em quais tipos de entrega você já percebeu problemas relevantes?", options_json=["Captação audiovisual","Edição de vídeo","Artes/peças gráficas","Textos/copys","Materiais institucionais","Campanhas","Cobertura de eventos","Publicação/postagem","Outro"], condition_json={"question_key":"final_quality","operator":"lte","value":7}, is_required=False, followup_json={"when_any":True,"prompt":"Se puder, cite um exemplo que ajude a entender o problema."}),
    dict(key="information_errors", position=9, section="Qualidade", question_type="single_choice", prompt="Já ocorreram erros de informação em materiais, como nomes de pessoas, empresas, cargos, datas ou dados?", options_json=["Nunca","Raramente","Algumas vezes","Frequentes","Muito frequentes"], dimension="qualidade", weight=1.2, scoring_json={"strategy":"map","map":{"nunca":100,"raramente":80,"algumas vezes":55,"frequentes":25,"muito frequentes":5}}, followup_json={"values":["Algumas vezes","Frequentes","Muito frequentes"],"prompt":"Qual erro ou situação mais te marcou?"}),
    dict(key="correction_resolution", position=10, section="Qualidade", question_type="scale_0_10", prompt="Quando há necessidade de correção ou retrabalho, de 0 a 10, como você avalia a resolução até o material voltar corrigido?", dimension="qualidade", scoring_json={"strategy":"scale","min":0,"max":10}, followup_json={"operator":"lte","value":6,"prompt":"O que normalmente falha no processo de correção?"}),
    dict(key="left_to_request", position=11, section="Confiança e perda de demanda", question_type="single_choice", prompt="Você já deixou de solicitar algum trabalho à Envox mesmo sabendo que poderia fazer parte da parceria?", options_json=["Não","Sim"], dimension="confianca", weight=1.5, scoring_json={"strategy":"map","map":{"não":100,"sim":20}}, followup_json={"values":["Sim"],"prompt":"Que trabalho deixou de solicitar? Se utilizou outra pessoa/agência, conte o motivo."}),
    dict(key="left_request_reasons", position=12, section="Confiança e perda de demanda", question_type="multi_choice", prompt="Por quais motivos esse trabalho deixou de chegar à Envox?", options_json=["Prazo","Qualidade anterior","Dificuldade de comunicação","Receio de retrabalho","Falta de confiança","Falta de proatividade","Não sabia que estava no escopo","Preferência por fornecedor local/terceiro","Outro"], condition_json={"question_key":"left_to_request","operator":"eq","value":"Sim"}, followup_json={"when_any":True,"prompt":"Há algo importante sobre essa decisão que precisamos saber?"}),
    dict(key="proactivity", position=13, section="Proatividade", question_type="scale_0_10", prompt="De 0 a 10, quanto você percebe a Envox atuando de forma proativa, sem depender apenas de pedidos?", dimension="proatividade", weight=1.3, scoring_json={"strategy":"scale","min":0,"max":10}, followup_json={"operator":"lte","value":6,"prompt":"Em que situação você esperava mais iniciativa?"}),
    dict(key="business_understanding", position=14, section="Proatividade", question_type="scale_0_10", prompt="De 0 a 10, quanto a Envox demonstra entender a realidade, objetivos e particularidades da sua área/unidade?", dimension="entendimento", weight=1.2, scoring_json={"strategy":"scale","min":0,"max":10}, followup_json={"operator":"lte","value":6,"prompt":"O que a Envox ainda precisa entender melhor sobre sua área?"}),
    dict(key="spontaneous_ideas", position=15, section="Proatividade", question_type="scale_0_10", prompt="De 0 a 10, como você avalia a frequência e relevância de ideias apresentadas espontaneamente pela Envox?", dimension="proatividade", scoring_json={"strategy":"scale","min":0,"max":10}),
    dict(key="improvement_ranking", position=16, section="Prioridades", question_type="ranking", prompt="Ordene os pontos que mais precisam melhorar, do mais importante para o menos importante.", options_json=["Atendimento/retorno","Prazo","Qualidade final","Correções/retrabalho","Comunicação","Proatividade","Entendimento do negócio","Direcionamento técnico/criativo","Confiabilidade das informações"]),
    dict(key="value_perception", position=17, section="Valor", question_type="scale_0_10", prompt="De 0 a 10, quanto valor você percebe hoje no trabalho da Envox para sua área?", dimension="confianca", scoring_json={"strategy":"scale","min":0,"max":10}, followup_json={"operator":"lte","value":6,"prompt":"O que precisaria acontecer para essa percepção de valor aumentar?"}),
    dict(key="expected_not_delivered", position=18, section="Demandas invisíveis", question_type="open_text", prompt="Existe alguma demanda, iniciativa ou entrega que você esperava da Envox e considera que não aconteceu? Descreva, mesmo que ela nunca tenha sido formalmente solicitada.", is_required=False),
    dict(key="trust_new_work", position=19, section="Confiança", question_type="scale_0_10", prompt="De 0 a 10, qual é hoje o seu nível de confiança para solicitar um novo trabalho à Envox?", dimension="confianca", weight=1.5, scoring_json={"strategy":"scale","min":0,"max":10}, followup_json={"operator":"lte","value":6,"prompt":"O que mais precisa mudar para recuperar sua confiança?"}),
]


@router.post("/bootstrap/secovi", status_code=201)
async def bootstrap_secovi(payload: VoiceBootstrapSecovi, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    client = (await db.execute(select(VoiceClient).where(VoiceClient.owner_user_id == current_user.id, VoiceClient.slug == "secovi-pr"))).scalar_one_or_none()
    if not client:
        client = VoiceClient(owner_user_id=current_user.id, name="Secovi-PR", slug="secovi-pr", legal_name="Secovi-PR"); db.add(client); await db.flush()
    template = (await db.execute(select(VoiceSurveyTemplate).where(VoiceSurveyTemplate.client_id == client.id, VoiceSurveyTemplate.name == "Pesquisa de Percepção e Qualidade da Parceria"))).scalar_one_or_none()
    if not template:
        template = VoiceSurveyTemplate(client_id=client.id, name="Pesquisa de Percepção e Qualidade da Parceria", description="Diagnóstico estruturado de atendimento, prazo, qualidade, proatividade, confiança e demandas perdidas."); db.add(template); await db.flush()
    max_ver = await db.scalar(select(func.max(VoiceSurveyVersion.version_number)).where(VoiceSurveyVersion.template_id == template.id))
    version = VoiceSurveyVersion(template_id=template.id, version_number=(max_ver or 0) + 1, status="published", title="Pesquisa confidencial de percepção e qualidade da parceria", intro_text="Queremos entender, com profundidade e sem respostas genéricas, como sua área percebe a parceria com a Envox e onde precisamos agir.", confidentiality_text="Esta pesquisa é confidencial e o link é individual. As respostas serão analisadas prioritariamente de forma consolidada. O acesso à identificação individual é restrito à liderança autorizada da Envox responsável pelo diagnóstico e pelo plano de ação.", settings_json={"estimated_minutes": 10, "client": "Secovi-PR"}, published_at=_now(), created_by=current_user.id)
    db.add(version); await db.flush()
    for qd in SECOVI_QUESTIONS: db.add(VoiceSurveyQuestion(version_id=version.id, **qd))
    campaign = VoiceSurveyCampaign(client_id=client.id, version_id=version.id, name=payload.campaign_name, status="active", public_base_url=payload.public_base_url, created_by=current_user.id, settings_json={"confidential": True, "anonymous": False})
    db.add(campaign); await db.commit(); await db.refresh(campaign)
    return {"client_id": str(client.id), "template_id": str(template.id), "version_id": str(version.id), "campaign_id": str(campaign.id), "questions": len(SECOVI_QUESTIONS), "next_step": "Importe os respondentes na campanha criada."}
