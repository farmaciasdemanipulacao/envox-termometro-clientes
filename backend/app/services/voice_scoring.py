"""Scoring e consolidação do módulo Voz do Cliente."""
from collections import Counter, defaultdict
from typing import Any

DIMENSION_LABELS = {
    "atendimento": "Atendimento",
    "prazo": "Prazo",
    "qualidade": "Qualidade",
    "proatividade": "Proatividade",
    "confianca": "Confiança",
    "entendimento": "Entendimento do negócio",
}

ACTION_BY_DIMENSION = {
    "atendimento": "Revisar canais, SLA de retorno inicial, responsáveis e fechamento de solicitações.",
    "prazo": "Mapear gargalos de prazo, pactuar SLA por tipo de entrega e criar alertas de atraso.",
    "qualidade": "Reforçar revisão técnica e factual antes de publicar, com checklist de briefing, referências, nomes, empresas e informações.",
    "proatividade": "Implantar rotina de sugestões proativas por área, com pauta mensal de oportunidades e próximos passos.",
    "confianca": "Fazer recuperação ativa de confiança com plano de ação, responsáveis, prazos e retorno de correções.",
    "entendimento": "Aprofundar briefing e repertório de cada unidade/setor antes de propor ou executar entregas.",
}


def _clamp(v: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, v))


def score_question(question, value: Any) -> float | None:
    cfg = question.scoring_json or {}
    strategy = cfg.get("strategy")
    if not strategy or value is None:
        return None

    if strategy == "scale":
        try:
            raw = float(value)
            min_v = float(cfg.get("min", 0))
            max_v = float(cfg.get("max", 10))
            if max_v <= min_v:
                return None
            normalized = ((raw - min_v) / (max_v - min_v)) * 100.0
            if cfg.get("reverse"):
                normalized = 100.0 - normalized
            return _clamp(normalized)
        except (TypeError, ValueError):
            return None

    if strategy == "map":
        mapping = cfg.get("map", {})
        key = str(value).strip().lower()
        mapped = mapping.get(key)
        if mapped is None:
            return None
        try:
            return _clamp(float(mapped))
        except (TypeError, ValueError):
            return None

    return None


def calculate_respondent_score(questions, answer_by_question_id):
    weighted = defaultdict(lambda: [0.0, 0.0])
    flags = {}

    for q in questions:
        answer = answer_by_question_id.get(q.id)
        if not answer:
            continue
        s = score_question(q, answer.value_json)
        if s is not None and q.dimension:
            weight = float(q.weight or 1.0)
            weighted[q.dimension][0] += s * weight
            weighted[q.dimension][1] += weight

        normalized = str(answer.value_json).strip().lower()
        if q.key == "left_to_request" and normalized in {"sim", "yes", "true"}:
            flags["left_to_request"] = True
        if q.key == "information_errors" and normalized in {"frequentes", "muito frequentes"}:
            flags["repeated_information_errors"] = True
        if q.key == "correction_resolution":
            if normalized == "foram necessárias novas tentativas para executar a mesma orientação já passada":
                flags["same_instruction_execution_failure"] = True
            elif normalized == "o pedido/briefing mudou entre uma versão e outra":
                flags["briefing_changed"] = True
            elif normalized == "aconteceram os dois cenários: mudança de pedido e falha na execução da orientação":
                flags["same_instruction_execution_failure"] = True
                flags["briefing_changed"] = True
            elif normalized == "a correção demorou ou o material não retornou adequadamente":
                flags["correction_flow_failure"] = True
        if q.key == "deadline_delivery":
            try:
                if float(answer.value_json) <= 5:
                    flags["deadline_risk"] = True
            except (TypeError, ValueError):
                pass
        if q.key == "trust_new_work":
            try:
                if float(answer.value_json) <= 5:
                    flags["low_trust"] = True
            except (TypeError, ValueError):
                pass

    dimensions = {
        key: round(total / weight, 1)
        for key, (total, weight) in weighted.items()
        if weight > 0
    }

    matrix_dims = [d for d in ("atendimento", "prazo", "qualidade", "proatividade", "confianca") if d in dimensions]
    if matrix_dims:
        perception = sum(dimensions[d] for d in matrix_dims) / len(matrix_dims)
    elif dimensions:
        perception = sum(dimensions.values()) / len(dimensions)
    else:
        perception = 0.0

    penalty = 0.0
    penalty += 12.0 if flags.get("left_to_request") else 0.0
    penalty += 8.0 if flags.get("repeated_information_errors") else 0.0
    penalty += 9.0 if flags.get("same_instruction_execution_failure") else 0.0
    penalty += 7.0 if flags.get("correction_flow_failure") else 0.0
    # Mudança de briefing é sinal diagnóstico, não penalidade automática contra a Envox.
    penalty += 7.0 if flags.get("deadline_risk") else 0.0
    penalty += 15.0 if flags.get("low_trust") else 0.0

    risk = _clamp((100.0 - perception) + penalty)
    if risk >= 65 or perception < 50:
        classification = "Crítico"
    elif risk >= 40 or perception < 75:
        classification = "Atenção"
    else:
        classification = "Saudável"

    return round(perception, 1), round(risk, 1), classification, dimensions, flags


def consolidate_matrix(respondents):
    groups = {}
    for r in respondents:
        dims = r.dimension_scores_json or {}
        segment_key = (r.unit or "Não informado", r.sector or "Não informado", r.regional or "Não informado")
        bucket = groups.setdefault(segment_key, {
            "unit": segment_key[0],
            "sector": segment_key[1],
            "regional": segment_key[2],
            "count": 0,
            "scores": defaultdict(list),
            "risk": [],
        })
        bucket["count"] += 1
        bucket["risk"].append(float(r.risk_score or 0))
        for dim in ("atendimento", "prazo", "qualidade", "proatividade", "confianca"):
            if dim in dims:
                bucket["scores"][dim].append(float(dims[dim]))

    matrix = []
    for bucket in groups.values():
        row = {
            "unit": bucket["unit"],
            "sector": bucket["sector"],
            "regional": bucket["regional"],
            "respondents": bucket["count"],
        }
        for dim in ("atendimento", "prazo", "qualidade", "proatividade", "confianca"):
            values = bucket["scores"].get(dim, [])
            row[dim] = round(sum(values) / len(values), 1) if values else None
        row["risk"] = round(sum(bucket["risk"]) / len(bucket["risk"]), 1) if bucket["risk"] else None
        matrix.append(row)

    matrix.sort(key=lambda x: (-(x["risk"] or 0), x["unit"], x["sector"]))
    return matrix


def build_recommendations(respondents):
    dim_values = defaultdict(list)
    for r in respondents:
        for dim, value in (r.dimension_scores_json or {}).items():
            try:
                dim_values[dim].append(float(value))
            except (TypeError, ValueError):
                pass

    ranked = []
    for dim, values in dim_values.items():
        if not values:
            continue
        avg = sum(values) / len(values)
        ranked.append((avg, dim))
    ranked.sort()

    return [
        {
            "dimension": dim,
            "label": DIMENSION_LABELS.get(dim, dim.title()),
            "score": round(avg, 1),
            "priority": "alta" if avg < 55 else "média" if avg < 75 else "monitorar",
            "action": ACTION_BY_DIMENSION.get(dim, "Investigar respostas abertas e definir ação com responsável e prazo."),
        }
        for avg, dim in ranked[:4]
    ]


def count_answer_values(questions, answers):
    """Agrega respostas categóricas e textos.

    Para ranking, aplica pontuação posicional (Borda): em uma lista de N itens,
    o 1º recebe N pontos, o 2º N-1 etc. Assim os itens não empatam artificialmente
    apenas porque todos aparecem uma vez em cada ranking.
    """
    question_by_id = {q.id: q for q in questions}
    counters = defaultdict(Counter)
    open_text = defaultdict(list)

    for a in answers:
        q = question_by_id.get(a.question_id)
        if not q:
            continue
        value = a.value_json
        if q.question_type == "ranking" and isinstance(value, list):
            total = len(value)
            for idx, item in enumerate(value):
                counters[q.key][str(item)] += max(total - idx, 1)
        elif isinstance(value, list):
            for item in value:
                counters[q.key][str(item)] += 1
        elif q.question_type in {"open_text", "text"}:
            if value:
                open_text[q.key].append(str(value))
        else:
            counters[q.key][str(value)] += 1
        if a.comment:
            open_text[f"{q.key}__comments"].append(a.comment)

    return counters, open_text
