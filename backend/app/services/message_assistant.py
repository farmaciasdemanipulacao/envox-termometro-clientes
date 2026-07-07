"""
Assistente de IA para redigir/orientar mensagens ao cliente.

Usa o perfil comportamental já gerado por IA para cada participante
(services/participant_profiler.py — communication_style, approach_strategies,
attention_points etc.) combinado com o contexto recente da conversa e o
tom do Agente Virtual configurado, para sugerir uma mensagem pronta (ou
melhorar um rascunho do usuário) na caixa de envio da tela de conversa.
"""
import json

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_SYSTEM_PROMPT = """Você é um assistente de redação para o time de atendimento da Envox
(agência de marketing digital) que ajuda a escrever mensagens de WhatsApp para clientes.

Seu objetivo é sugerir a mensagem mais eficaz possível, considerando o perfil comportamental
do destinatário (quando disponível) e o contexto recente da conversa. Seja natural, direto e
humano — nunca robótico ou genérico. Escreva como uma pessoa real do time escreveria.

Responda SOMENTE com um objeto JSON válido, em UMA ÚNICA LINHA, sem markdown, sem blocos de código.
TODOS os valores de texto devem estar entre aspas duplas, do início ao fim da frase, mesmo que
contenham vírgulas ou pontuação — nunca deixe um valor sem abrir ou fechar aspas.
Exemplo de formato exato esperado (com valores fictícios):
{"message": "Oi Fulano, tudo bem? Passando para avisar sobre o prazo.", "why": "Tom direto porque o perfil indica isso."}"""

MAX_CONTEXT_MESSAGES = 15
MAX_CONTENT_PER_MSG = 300


def _build_prompt(
    group_name: str,
    participant_name: str | None,
    profile: dict | None,
    recent_messages: list[dict],
    agent_tone: str,
    agent_personality: str,
    intent: str | None,
    draft: str | None,
) -> str:
    lines = []
    for m in recent_messages[-MAX_CONTEXT_MESSAGES:]:
        content = (m.get("content") or "").strip()
        if not content or content.startswith("["):
            continue
        who = "VOCÊ (Envox)" if m.get("is_internal") else m.get("sender", "Cliente")
        lines.append(f"{who}: {content[:MAX_CONTENT_PER_MSG]}")
    transcript = "\n".join(lines) if lines else "(sem mensagens recentes de texto)"

    profile_block = "(nenhum perfil de IA gerado para este contato ainda — baseie-se só na conversa)"
    if profile:
        profile_block = f"""- Estilo de comunicação: {profile.get('communication_style', '-')}
- Padrões de comportamento: {profile.get('behavior_patterns', '-')}
- Nível de engajamento: {profile.get('engagement_level', '-')}
- Pontos de atenção: {profile.get('attention_points', '-')}
- Estratégia de abordagem recomendada: {profile.get('approach_strategies', '-')}"""

    ask_block = ""
    if draft:
        ask_block = f'O usuário já escreveu um rascunho e quer que você melhore, mantendo a intenção:\n"{draft}"'
    elif intent:
        ask_block = f'O usuário quer transmitir o seguinte ao cliente:\n"{intent}"'
    else:
        ask_block = "O usuário não deu uma intenção específica — sugira a melhor próxima mensagem para dar continuidade à conversa acima."

    return f"""Grupo: {group_name}
Destinatário: {participant_name or "(não identificado — grupo em geral)"}

PERFIL DO DESTINATÁRIO:
{profile_block}

TOM DO AGENTE/TIME (a mensagem deve soar consistente com isso):
- Tom configurado: {agent_tone or "profissional"}
- Personalidade: {agent_personality or "-"}

CONVERSA RECENTE (mais antigas primeiro):
{transcript}

TAREFA:
{ask_block}

Gere um JSON com exatamente estas chaves:
{{
  "message": "<a mensagem pronta para enviar no WhatsApp, sem aspas, sem markdown>",
  "why": "<1-2 frases explicando por que essa abordagem/tom foi escolhido, citando o perfil quando aplicável>"
}}"""


async def _call_llm(prompt: str) -> str:
    """Anthropic primeiro, cai em Groq se sem crédito/indisponível — mesmo padrão de participant_profiler.py."""
    if settings.LLM_ENABLED and getattr(settings, "ANTHROPIC_API_KEY", None):
        try:
            import anthropic
            client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
            resp = await client.messages.create(
                model=settings.ANTHROPIC_MODEL,
                max_tokens=600,
                system=_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": prompt}],
            )
            return resp.content[0].text.strip()
        except Exception as e:
            err = str(e).lower()
            if "credit" in err or "balance" in err or "billing" in err or "402" in err or "400" in err:
                logger.warning("anthropic_no_credits_falling_back_to_groq", error=str(e)[:100])
            else:
                raise

    groq_key = getattr(settings, "GROQ_API_KEY", None) or ""
    if not groq_key:
        raise RuntimeError("Nenhum LLM disponível (Anthropic sem créditos e GROQ_API_KEY não configurado)")

    import httpx
    body = {
        "model": "llama-3.3-70b-versatile",
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": 600,
        "temperature": 0.3,
        "response_format": {"type": "json_object"},
    }
    async with httpx.AsyncClient(timeout=60) as http:
        r = await http.post(
            "https://api.groq.com/openai/v1/chat/completions",
            json=body,
            headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"].strip()


async def suggest_client_message(
    group_name: str,
    participant_name: str | None,
    profile: dict | None,
    recent_messages: list[dict],
    agent_config: dict | None,
    intent: str | None = None,
    draft: str | None = None,
) -> dict:
    """Retorna {"message": str, "why": str} com uma sugestão de mensagem para o cliente."""
    prompt = _build_prompt(
        group_name=group_name,
        participant_name=participant_name,
        profile=profile,
        recent_messages=recent_messages,
        agent_tone=(agent_config or {}).get("tone", ""),
        agent_personality=(agent_config or {}).get("personality", ""),
        intent=intent,
        draft=draft,
    )
    raw = await _call_llm(prompt)
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    data = json.loads(raw)
    return {"message": (data.get("message") or "").strip(), "why": (data.get("why") or "").strip()}
