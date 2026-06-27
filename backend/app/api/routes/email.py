"""
Endpoints de gerenciamento de contas de e-mail monitoradas (IMAP).
"""
import base64
import uuid
import imaplib
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.email_account import EmailAccount
from app.core.logging import get_logger

router = APIRouter()
logger = get_logger(__name__)


def _enc(password: str) -> str:
    return base64.b64encode(password.encode()).decode()


def _dec(encoded: str) -> str:
    return base64.b64decode(encoded.encode()).decode()


class EmailAccountCreate(BaseModel):
    label: str
    host: str
    port: int = 993
    username: str
    password: str
    use_ssl: bool = True


class EmailAccountOut(BaseModel):
    id: uuid.UUID
    label: str
    host: str
    port: int
    username: str
    use_ssl: bool
    is_active: bool
    last_sync_at: Optional[str] = None
    last_error: Optional[str] = None

    class Config:
        from_attributes = True


def _to_out(acc: EmailAccount) -> dict:
    return {
        "id": str(acc.id),
        "label": acc.label,
        "host": acc.host,
        "port": acc.port,
        "username": acc.username,
        "use_ssl": acc.use_ssl,
        "is_active": acc.is_active,
        "last_sync_at": acc.last_sync_at.isoformat() if acc.last_sync_at else None,
        "last_error": acc.last_error,
    }


@router.get("/email-accounts")
async def list_email_accounts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(EmailAccount)
        .where(EmailAccount.tenant_id == current_user.id)
        .order_by(EmailAccount.created_at)
    )
    accounts = result.scalars().all()
    return [_to_out(a) for a in accounts]


@router.post("/email-accounts", status_code=201)
async def create_email_account(
    payload: EmailAccountCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    acc = EmailAccount(
        tenant_id=current_user.id,
        label=payload.label.strip(),
        host=payload.host.strip(),
        port=payload.port,
        username=payload.username.strip(),
        password_enc=_enc(payload.password),
        use_ssl=payload.use_ssl,
        is_active=True,
    )
    db.add(acc)
    await db.commit()
    await db.refresh(acc)
    logger.info("email_account_created", id=str(acc.id), label=acc.label, user=current_user.username)
    return _to_out(acc)


@router.delete("/email-accounts/{account_id}", status_code=204)
async def delete_email_account(
    account_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(EmailAccount).where(
            EmailAccount.id == account_id,
            EmailAccount.tenant_id == current_user.id,
        )
    )
    acc = result.scalar_one_or_none()
    if not acc:
        raise HTTPException(status_code=404, detail="Conta não encontrada")
    await db.delete(acc)
    await db.commit()
    logger.info("email_account_deleted", id=str(account_id), user=current_user.username)


@router.post("/email-accounts/{account_id}/test")
async def test_email_connection(
    account_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(EmailAccount).where(
            EmailAccount.id == account_id,
            EmailAccount.tenant_id == current_user.id,
        )
    )
    acc = result.scalar_one_or_none()
    if not acc:
        raise HTTPException(status_code=404, detail="Conta não encontrada")

    try:
        password = _dec(acc.password_enc)
        if acc.use_ssl:
            imap = imaplib.IMAP4_SSL(acc.host, acc.port, timeout=8)
        else:
            imap = imaplib.IMAP4(acc.host, acc.port)
        imap.login(acc.username, password)
        imap.logout()

        acc.last_error = None
        await db.commit()
        return {"ok": True, "message": "Conexão IMAP bem-sucedida"}
    except Exception as e:
        error_msg = str(e)
        acc.last_error = error_msg
        await db.commit()
        return {"ok": False, "message": f"Erro: {error_msg}"}
