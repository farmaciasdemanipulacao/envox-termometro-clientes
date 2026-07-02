"""
Motor de heurísticas — coração da análise ENVOX Intelligence.

Aplica regras baseadas em palavras-chave, padrões e contexto para classificar mensagens.
Projetado para ser:
- Extensível: adicione novas regras sem quebrar as existentes
- Testável: cada regra é uma função pura
- Barato: zero custo por mensagem (sem LLM)
- Preciso o suficiente para triagem (~70-80% dos casos)

A interface AnalyzerResult é compatível com futura implementação LLM.
"""
import re
from dataclasses import dataclass, field
from typing import Optional


# =============================================================================
# DICIONÁRIOS DE PALAVRAS-CHAVE (calibrados para atendimento B2B/B2C Brasil)
# =============================================================================

# Reclamação / Insatisfação
COMPLAINT_KEYWORDS = [
    "insatisfeito", "insatisfação", "péssimo", "horrível", "terrível", "absurdo",
    "inadmissível", "inaceitável", "vergonha", "decepcionado", "decepção",
    "reclamação", "reclamar", "problema", "erro", "falha", "defeito",
    "não funciona", "não funcionou", "não resolveu", "ainda não", "até agora nada",
    "demora", "demorou", "esperando", "esperei", "quanto tempo",
    "não adiantou", "piorou", "ridículo", "lamentável", "descaso",
    "fui mal atendido", "mal atendido", "não me ajudaram",
]

# Risco de Churn / Cancelamento
CHURN_KEYWORDS = [
    "cancelar", "cancelo", "cancelamento", "cancelei", "quero cancelar",
    "vou cancelar", "cancela", "encerrar contrato", "encerrar serviço",
    "rescindir", "rescisão", "sair", "desistir", "desisti",
    "não quero mais", "não preciso mais", "estou saindo",
    "concorrente", "outra empresa", "outro fornecedor", "estou indo embora",
    "procurando alternativa", "buscando alternativa",
]

# Urgência
URGENCY_KEYWORDS = [
    "urgente", "urgência", "urgentemente", "imediatamente", "imediato",
    "agora", "agora mesmo", "preciso agora", "emergência", "emergencial",
    "crítico", "crítica", "parou", "travou", "caiu", "sistema fora",
    "produção parada", "não consigo acessar", "bloqueado", "bloqueada",
    "prazo", "amanhã", "hoje", "já", "o mais rápido possível", "o quanto antes",
]

# Promessa / Compromisso
PROMISE_KEYWORDS = [
    "vou verificar", "vou checar", "vou confirmar", "vou retornar",
    "te retorno", "retorno até", "confirmo até", "verifico e te falo",
    "vou providenciar", "vou resolver", "resolverei", "farei",
    "pode deixar que", "fico responsável", "fica por minha conta",
    "vou enviar", "enviarei", "mando", "encaminho",
    "até segunda", "até terça", "até quarta", "até quinta", "até sexta",
    "até amanhã", "até hoje", "até o fim do dia", "até fim de semana",
    "prometo", "garanto", "com certeza", "pode contar",
]

# Follow-up necessário / Pedido de retorno
FOLLOWUP_KEYWORDS = [
    "me retorna", "me liga", "me chama", "me avisa", "me fala",
    "aguardando retorno", "aguardo retorno", "espero retorno",
    "quando tiver resposta", "quando souber", "você me confirma",
    "preciso de resposta", "aguardo resposta", "respondeu?",
    "ficou de me ligar", "ficou de me falar", "ficou de confirmar",
    "e aquele", "e aquele assunto", "já tem novidade", "tem novidade",
    "cadê", "cadê a resposta", "cadê o retorno",
]

# Oportunidade Comercial / Upsell — keywords FORTES disparam sozinhas (inequívocas)
OPPORTUNITY_STRONG_KEYWORDS = [
    "quero contratar", "me manda proposta", "manda orçamento", "preciso de orçamento",
    "quanto custa", "qual o valor", "qual o preço", "me passa o preço",
    "quero expandir", "quero ampliar", "posso contratar mais",
    "novo projeto", "nova demanda", "nova necessidade",
    "podemos fechar", "vamos fechar", "quero fechar",
]

# Oportunidade Comercial — keywords FRACAS, ambíguas fora de contexto comercial
# (ex.: "aprovado"/"topei" também aparecem em aprovação de material/arte, não só em negócio).
# Só viram tag se houver COMMERCIAL_CONTEXT_KEYWORDS na mensagem ou nas mensagens recentes da conversa.
OPPORTUNITY_WEAK_KEYWORDS = [
    "tenho interesse", "interessado", "interessada",
    "expandir", "ampliar", "quero mais", "precisamos de mais", "vamos aumentar",
    "indicação", "indiquei", "vou indicar", "conhece alguém",
    "topei", "aprovado", "aprovamos", "pode ir em frente",
]

# Termos que confirmam que o contexto da conversa é de fato comercial — usados para
# corroborar uma keyword fraca de oportunidade (na própria mensagem ou no contexto recente).
COMMERCIAL_CONTEXT_KEYWORDS = [
    "orçamento", "proposta", "contrato", "contratar", "mensalidade",
    "valor", "preço", "plano", "investimento", "fechamento", "negócio",
    "comercial", "cobrança", "pacote", "upsell", "upgrade",
]

# Atrito Interno (entre colaboradores)
FRICTION_KEYWORDS = [
    "não foi passado", "não me avisaram", "ninguém me falou",
    "quem deveria ter", "responsabilidade de", "culpa do",
    "não é minha função", "não é meu papel", "não me compete",
    "já falei disso", "falei e ninguém", "fica jogando",
    "retrabalho", "fiz de novo", "tive que refazer",
    "sem comunicação", "falta de comunicação", "perdido",
]

# Escalada Emocional
ESCALATION_KEYWORDS = [
    "chega!", "basta!", "não aguento mais", "cansado", "cansada",
    "estou furioso", "furiosa", "muito irritado", "irritada",
    "que absurdo", "é um absurdo", "vou escalar", "quero falar com",
    "quero falar com o responsável", "quero falar com o dono",
    "vou ao procon", "procon", "reclame aqui", "vou reclamar publicamente",
    "redes sociais", "publicar isso", "passar para frente",
    "MAIÚSCULAS", "!!!", "???",  # esses são checados via regex especial
]

# Sinais Positivos / Satisfação
POSITIVE_KEYWORDS = [
    "obrigado", "obrigada", "grato", "grata", "muito bom", "excelente",
    "ótimo", "ótima", "perfeito", "perfeita", "adorei", "amei",
    "muito satisfeito", "satisfeita", "resolvido", "resolveu",
    "funcionou", "deu certo", "deu tudo certo", "sucesso",
    "parabéns", "recomendo", "recomendaria", "muito bom atendimento",
    "atendimento excelente", "equipe incrível",
]


# =============================================================================
# RESULTADO DA ANÁLISE
# =============================================================================

@dataclass
class AnalyzerResult:
    """
    Resultado completo da análise de uma mensagem.
    Interface unificada — compatível com heurísticas e futuro LLM.
    """
    # Sentimento
    sentiment: str = "unknown"           # positive/neutral/negative/critical
    sentiment_score: float = 0.0         # -1.0 a +1.0

    # Scores
    risk_score: int = 0                  # 0-100
    opportunity_score: int = 0           # 0-100

    # Urgência
    urgency_level: str = "none"          # none/low/medium/high/critical

    # Flags
    is_followup_needed: bool = False
    is_promise_detected: bool = False
    is_complaint: bool = False
    is_escalation: bool = False
    is_opportunity: bool = False
    is_internal_friction: bool = False
    is_churn_risk: bool = False

    # Tags detectadas
    tags: list[str] = field(default_factory=list)


# =============================================================================
# MOTOR DE HEURÍSTICAS
# =============================================================================

class HeuristicsEngine:
    """
    Analisa mensagens aplicando regras heurísticas.

    Uso:
        engine = HeuristicsEngine()
        result = engine.analyze("Quero cancelar, estou muito insatisfeito!")
    """

    def analyze(
        self,
        text: str,
        participant_role: str = "unknown",
        context_texts: Optional[list[str]] = None,
    ) -> AnalyzerResult:
        """
        Analisa um texto e retorna o resultado de classificação.

        Args:
            text: conteúdo da mensagem
            participant_role: papel do autor (customer/collaborator/manager/unknown)
            context_texts: mensagens recentes da mesma conversa (mais antiga → mais nova),
                usadas só para corroborar sinais ambíguos (ex.: oportunidade comercial)

        Returns:
            AnalyzerResult com todos os campos preenchidos
        """
        if not text or not text.strip():
            return AnalyzerResult()

        normalized = self._normalize(text)
        result = AnalyzerResult()
        tags = []

        # --- Detecção de flags ---

        # Reclamação
        complaint_hits = self._count_hits(normalized, COMPLAINT_KEYWORDS)
        if complaint_hits > 0:
            result.is_complaint = True
            tags.append("reclamacao")

        # Churn
        churn_hits = self._count_hits(normalized, CHURN_KEYWORDS)
        if churn_hits > 0:
            result.is_churn_risk = True
            tags.append("risco_churn")

        # Urgência
        urgency_hits = self._count_hits(normalized, URGENCY_KEYWORDS)
        if urgency_hits >= 3:
            result.urgency_level = "critical"
            tags.append("urgencia_critica")
        elif urgency_hits >= 2:
            result.urgency_level = "high"
            tags.append("urgencia_alta")
        elif urgency_hits >= 1:
            result.urgency_level = "medium"
            tags.append("urgencia_media")

        # Promessa
        promise_hits = self._count_hits(normalized, PROMISE_KEYWORDS)
        if promise_hits > 0:
            result.is_promise_detected = True
            tags.append("promessa_detectada")

        # Follow-up
        followup_hits = self._count_hits(normalized, FOLLOWUP_KEYWORDS)
        if followup_hits > 0:
            result.is_followup_needed = True
            tags.append("followup_necessario")

        # Oportunidade — forte dispara sozinha; fraca só com corroboração de contexto comercial
        strong_opportunity_hits = self._count_hits(normalized, OPPORTUNITY_STRONG_KEYWORDS)
        weak_opportunity_hits = self._count_hits(normalized, OPPORTUNITY_WEAK_KEYWORDS)
        opportunity_hits = strong_opportunity_hits

        if strong_opportunity_hits > 0:
            result.is_opportunity = True
            tags.append("oportunidade_comercial")
        elif weak_opportunity_hits > 0:
            context_normalized = " ".join(self._normalize(t) for t in (context_texts or []) if t)
            has_commercial_context = (
                self._count_hits(normalized, COMMERCIAL_CONTEXT_KEYWORDS) > 0
                or self._count_hits(context_normalized, COMMERCIAL_CONTEXT_KEYWORDS) > 0
            )
            if has_commercial_context:
                result.is_opportunity = True
                tags.append("oportunidade_comercial")
                opportunity_hits += weak_opportunity_hits

        # Atrito interno (só para colaboradores)
        if participant_role in ("collaborator", "manager", "unknown"):
            friction_hits = self._count_hits(normalized, FRICTION_KEYWORDS)
            if friction_hits > 0:
                result.is_internal_friction = True
                tags.append("atrito_interno")

        # Escalada emocional
        escalation_hits = self._count_hits(normalized, ESCALATION_KEYWORDS)
        escalation_hits += self._detect_escalation_patterns(text)
        if escalation_hits > 0:
            result.is_escalation = True
            tags.append("escalada_emocional")

        # --- Calcular sentimento ---
        positive_hits = self._count_hits(normalized, POSITIVE_KEYWORDS)
        negative_hits = complaint_hits + churn_hits + escalation_hits

        result.sentiment, result.sentiment_score = self._calculate_sentiment(
            positive_hits, negative_hits, result.is_churn_risk, result.is_escalation
        )

        # --- Calcular risk_score (0-100) ---
        result.risk_score = self._calculate_risk_score(
            complaint_hits=complaint_hits,
            churn_hits=churn_hits,
            urgency_level=result.urgency_level,
            is_escalation=result.is_escalation,
            is_internal_friction=result.is_internal_friction,
            sentiment_score=result.sentiment_score,
        )

        # --- Calcular opportunity_score (0-100) ---
        result.opportunity_score = self._calculate_opportunity_score(
            opportunity_hits=opportunity_hits,
            positive_hits=positive_hits,
        )

        result.tags = tags
        return result

    # =========================================================================
    # MÉTODOS PRIVADOS
    # =========================================================================

    def _normalize(self, text: str) -> str:
        """Normaliza texto para comparação: minúsculas, remove acentos básicos."""
        import unicodedata
        # Remove acentos para matching mais amplo
        normalized = unicodedata.normalize("NFD", text.lower())
        normalized = "".join(c for c in normalized if unicodedata.category(c) != "Mn")
        return normalized

    def _count_hits(self, normalized_text: str, keywords: list[str]) -> int:
        """Conta quantas keywords foram encontradas no texto."""
        count = 0
        for kw in keywords:
            # Normaliza também a keyword para comparação
            import unicodedata
            kw_norm = unicodedata.normalize("NFD", kw.lower())
            kw_norm = "".join(c for c in kw_norm if unicodedata.category(c) != "Mn")
            if kw_norm in normalized_text:
                count += 1
        return count

    def _detect_escalation_patterns(self, original_text: str) -> int:
        """
        Detecta padrões de escalada emocional que dependem do texto original:
        - MAIÚSCULAS excessivas
        - Pontuação excessiva (!!! ou ???)
        """
        hits = 0
        # Maiúsculas: mais de 5 palavras em caps = possível irritação
        caps_words = re.findall(r'\b[A-Z]{3,}\b', original_text)
        if len(caps_words) >= 3:
            hits += 1
        # Pontuação excessiva
        if re.search(r'[!?]{3,}', original_text):
            hits += 1
        return hits

    def _calculate_sentiment(
        self,
        positive_hits: int,
        negative_hits: int,
        is_churn_risk: bool,
        is_escalation: bool,
    ) -> tuple[str, float]:
        """
        Calcula sentimento e score baseado nos hits.
        Returns: (label, score) onde score é -1.0 a +1.0
        """
        # Casos extremos
        if is_escalation or (is_churn_risk and negative_hits >= 2):
            return "critical", -0.9

        if negative_hits == 0 and positive_hits == 0:
            return "neutral", 0.0

        total = positive_hits + negative_hits
        if total == 0:
            return "neutral", 0.0

        score = (positive_hits - negative_hits) / max(total, 1)
        score = max(-1.0, min(1.0, score))

        if score >= 0.3:
            return "positive", score
        elif score <= -0.5:
            return "negative", score
        elif score <= -0.8 or is_churn_risk:
            return "critical", score
        else:
            return "neutral", score

    def _calculate_risk_score(
        self,
        complaint_hits: int,
        churn_hits: int,
        urgency_level: str,
        is_escalation: bool,
        is_internal_friction: bool,
        sentiment_score: float,
    ) -> int:
        """
        Calcula risk_score de 0 a 100.
        Combinação ponderada dos sinais de risco.
        """
        score = 0

        # Churn é o maior risco individual
        score += min(churn_hits * 30, 50)

        # Reclamações
        score += min(complaint_hits * 10, 25)

        # Urgência
        urgency_weight = {"none": 0, "low": 5, "medium": 10, "high": 20, "critical": 30}
        score += urgency_weight.get(urgency_level, 0)

        # Escalada emocional
        if is_escalation:
            score += 25

        # Atrito interno
        if is_internal_friction:
            score += 10

        # Sentimento negativo
        if sentiment_score < 0:
            score += int(abs(sentiment_score) * 15)

        return min(score, 100)

    def _calculate_opportunity_score(
        self,
        opportunity_hits: int,
        positive_hits: int,
    ) -> int:
        """
        Calcula opportunity_score de 0 a 100.
        """
        score = 0
        score += min(opportunity_hits * 35, 70)
        score += min(positive_hits * 5, 30)
        return min(score, 100)


# Instância global reutilizável
heuristics_engine = HeuristicsEngine()
