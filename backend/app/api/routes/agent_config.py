"""Endpoints de configuração do Agente Virtual."""
import base64
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.agent_config import AgentConfig, DEFAULT_EXPRESSIONS, EXPRESSION_TYPES
from app.core.logging import get_logger

router = APIRouter(prefix="/agent", tags=["Agente Virtual"])
logger = get_logger(__name__)

MAX_IMAGE_BYTES = 3 * 1024 * 1024  # 3 MB
ALLOWED_MIMES = {"image/png", "image/jpeg", "image/gif", "image/webp"}


class AgentConfigUpdate(BaseModel):
    name: Optional[str] = None
    role_label: Optional[str] = None
    personality: Optional[str] = None
    tone: Optional[str] = None
    signature: Optional[str] = None
    expressions: Optional[list] = None   # lista de {type, label, emoji}


async def _get_or_create(db: AsyncSession, tenant_id) -> AgentConfig:
    result = await db.execute(
        select(AgentConfig).where(AgentConfig.tenant_id == tenant_id)
    )
    cfg = result.scalar_one_or_none()
    if not cfg:
        cfg = AgentConfig(
            tenant_id=tenant_id,
            name="Agente ENVOX",
            tone="profissional",
            expressions=list(DEFAULT_EXPRESSIONS),
        )
        db.add(cfg)
        await db.flush()
    return cfg


def _cfg_out(cfg: AgentConfig) -> dict:
    exprs = cfg.expressions or list(DEFAULT_EXPRESSIONS)
    return {
        "name": cfg.name,
        "role_label": cfg.role_label,
        "personality": cfg.personality,
        "tone": cfg.tone,
        "signature": cfg.signature,
        "avatar_url": f"data:{cfg.avatar_mime};base64,{cfg.avatar_b64}" if cfg.avatar_b64 else None,
        "expressions": [
            {
                "type": e.get("type"),
                "label": e.get("label"),
                "emoji": e.get("emoji"),
                "image_url": f"data:{e['image_mime']};base64,{e['image_b64']}" if e.get("image_b64") else None,
            }
            for e in exprs
        ],
    }


@router.get("/config")
async def get_agent_config(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cfg = await _get_or_create(db, current_user.id)
    await db.commit()
    return _cfg_out(cfg)


@router.put("/config")
async def update_agent_config(
    payload: AgentConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cfg = await _get_or_create(db, current_user.id)

    if payload.name is not None:
        cfg.name = payload.name.strip()[:100] or "Agente ENVOX"
    if payload.role_label is not None:
        cfg.role_label = payload.role_label.strip()[:200] or None
    if payload.personality is not None:
        cfg.personality = payload.personality.strip() or None
    if payload.tone is not None and payload.tone in ("formal", "profissional", "amigavel", "casual"):
        cfg.tone = payload.tone
    if payload.signature is not None:
        cfg.signature = payload.signature.strip()[:500] or None

    # Atualiza expressões (apenas emoji e label; imagens via endpoint próprio)
    if payload.expressions is not None:
        existing = {e["type"]: e for e in (cfg.expressions or [])}
        updated = []
        for expr in payload.expressions:
            t = expr.get("type", "").strip()
            if not t or len(t) > 50 or not t.replace("_", "").isalnum():
                continue
            base = existing.get(t, {"type": t, "label": t, "emoji": "🤖", "image_b64": None, "image_mime": None})
            updated.append({
                "type": t,
                "label": (expr.get("label") or base.get("label") or t)[:50],
                "emoji": expr.get("emoji", base.get("emoji", "🤖")),
                "image_b64": base.get("image_b64"),
                "image_mime": base.get("image_mime"),
            })
        cfg.expressions = updated

    await db.commit()
    logger.info("agent_config_updated", tenant=str(current_user.id), name=cfg.name)
    return _cfg_out(cfg)


@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content = await file.read()
    mime = file.content_type or "image/png"
    if mime not in ALLOWED_MIMES:
        raise HTTPException(400, "Formato não suportado. Use PNG, JPEG, GIF ou WebP.")
    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(400, f"Imagem muito grande. Máximo: {MAX_IMAGE_BYTES // 1024 // 1024}MB.")

    cfg = await _get_or_create(db, current_user.id)
    cfg.avatar_b64 = base64.b64encode(content).decode()
    cfg.avatar_mime = mime
    await db.commit()

    url = f"data:{mime};base64,{cfg.avatar_b64}"
    return {"avatar_url": url}


@router.delete("/avatar")
async def delete_avatar(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cfg = await _get_or_create(db, current_user.id)
    cfg.avatar_b64 = None
    cfg.avatar_mime = None
    await db.commit()
    return {"status": "removed"}


@router.post("/expression/{expr_type}")
async def upload_expression_image(
    expr_type: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not expr_type or len(expr_type) > 50 or not expr_type.replace("_", "").isalnum():
        raise HTTPException(400, "Tipo de expressão inválido.")
    content = await file.read()
    mime = file.content_type or "image/png"
    if mime not in ALLOWED_MIMES:
        raise HTTPException(400, "Formato não suportado.")
    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(400, "Imagem muito grande.")

    cfg = await _get_or_create(db, current_user.id)
    exprs = list(cfg.expressions or DEFAULT_EXPRESSIONS)

    found = False
    for e in exprs:
        if e.get("type") == expr_type:
            e["image_b64"] = base64.b64encode(content).decode()
            e["image_mime"] = mime
            found = True
            break
    if not found:
        exprs.append({
            "type": expr_type, "label": expr_type, "emoji": "🤖",
            "image_b64": base64.b64encode(content).decode(), "image_mime": mime,
        })

    cfg.expressions = exprs
    await db.commit()
    url = f"data:{mime};base64,{base64.b64encode(content).decode()}"
    return {"image_url": url, "type": expr_type}


@router.delete("/expression/{expr_type}")
async def delete_expression_image(
    expr_type: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not expr_type or len(expr_type) > 50:
        raise HTTPException(400, "Tipo de expressão inválido.")
    cfg = await _get_or_create(db, current_user.id)
    exprs = list(cfg.expressions or [])
    for e in exprs:
        if e.get("type") == expr_type:
            e["image_b64"] = None
            e["image_mime"] = None
    cfg.expressions = exprs
    await db.commit()
    return {"status": "removed", "type": expr_type}
