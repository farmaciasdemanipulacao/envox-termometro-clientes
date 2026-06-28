"""Helpers para identidade do agente virtual nos resumos e mensagens."""
from __future__ import annotations
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


async def get_agent_config(db: AsyncSession, tenant_id) -> dict | None:
    """Carrega o AgentConfig do tenant. Retorna None se não configurado."""
    from app.models.agent_config import AgentConfig
    result = await db.execute(
        select(AgentConfig).where(AgentConfig.tenant_id == tenant_id)
    )
    cfg = result.scalar_one_or_none()
    if not cfg:
        return None
    return _to_dict(cfg)


def _to_dict(cfg) -> dict:
    exprs = cfg.expressions or []
    return {
        "name": cfg.name or "Agente ENVOX",
        "role_label": cfg.role_label or "",
        "personality": cfg.personality or "",
        "tone": cfg.tone or "profissional",
        "signature": cfg.signature or "",
        "avatar_b64": cfg.avatar_b64,
        "avatar_mime": cfg.avatar_mime,
        "expressions": exprs,
    }


def get_expression_emoji(agent_config: dict | None, expr_type: str) -> str:
    """Retorna o emoji da expressão, com fallback para padrões."""
    defaults = {
        "neutral": "🤖", "positive": "✅", "alert": "⚠️",
        "critical": "🚨", "thinking": "🧠",
    }
    if not agent_config:
        return defaults.get(expr_type, "🤖")
    for expr in agent_config.get("expressions", []):
        if expr.get("type") == expr_type:
            return expr.get("emoji") or defaults.get(expr_type, "🤖")
    return defaults.get(expr_type, "🤖")


def temperature_to_expression(temperature_label: str) -> str:
    """Mapeia label de temperatura para tipo de expressão."""
    mapping = {
        "critico": "critical",
        "alerta": "alert",
        "moderado": "alert",
        "saudavel": "positive",
        "neutro": "neutral",
    }
    return mapping.get(temperature_label, "neutral")


def build_agent_header(agent_config: dict | None, expr_type: str = "neutral") -> str:
    """Constrói o cabeçalho de identidade do agente para mensagens."""
    if not agent_config:
        return ""
    name = agent_config.get("name", "Agente ENVOX")
    role = agent_config.get("role_label", "")
    emoji = get_expression_emoji(agent_config, expr_type)
    role_str = f" — {role}" if role else ""
    return f"{emoji} *{name}{role_str}*\n━━━━━━━━━━━━━━━━━\n"


def build_agent_footer(agent_config: dict | None, expr_type: str = "neutral") -> str:
    """Constrói o rodapé/assinatura do agente."""
    if not agent_config:
        return ""
    name = agent_config.get("name", "Agente ENVOX")
    signature = agent_config.get("signature", "")
    sig_str = f"\n_{signature}_" if signature else ""
    return f"\n━━━━━━━━━━━━━━━━━\n📝 _Gerado por {name} · ENVOX Intelligence_{sig_str}"


def inject_agent_identity(text: str, agent_config: dict | None, temperature_label: str = "neutro") -> str:
    """Envolve um texto de resumo com a identidade do agente."""
    if not agent_config:
        return text
    expr_type = temperature_to_expression(temperature_label)
    header = build_agent_header(agent_config, expr_type)
    footer = build_agent_footer(agent_config, expr_type)
    return f"{header}{text}{footer}"


def build_agent_personality_prompt(agent_config: dict | None) -> str:
    """Constrói o prefixo de personalidade para prompts LLM."""
    if not agent_config:
        return ""
    name = agent_config.get("name", "Agente ENVOX")
    role = agent_config.get("role_label", "analista de operações")
    personality = agent_config.get("personality", "")
    tone_map = {
        "formal": "formal e técnico",
        "profissional": "profissional e objetivo",
        "amigavel": "amigável e acessível",
        "casual": "casual e direto",
    }
    tone_desc = tone_map.get(agent_config.get("tone", "profissional"), "profissional")
    parts = [f"Você é {name}, {role}."]
    if personality:
        parts.append(f"Sua personalidade: {personality}")
    parts.append(f"Use tom {tone_desc}.")
    return " ".join(parts)
