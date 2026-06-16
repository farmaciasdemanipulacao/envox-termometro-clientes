"""
Autenticação e segurança.
- JWT para usuários do dashboard
- API Key para conectores externos de ingestão
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
import hashlib
import secrets

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

# Contexto de hash de senhas
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# === JWT ===

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Cria um JWT de acesso."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    """Decodifica e valida um JWT. Retorna None se inválido."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


# === SENHAS ===

def hash_password(password: str) -> str:
    """Retorna o hash bcrypt de uma senha."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica senha contra hash."""
    return pwd_context.verify(plain_password, hashed_password)


# === API KEYS ===

def generate_api_key() -> tuple[str, str]:
    """
    Gera um par (api_key, api_key_hash).
    Armazene apenas o hash. Mostre a api_key apenas uma vez ao usuário.
    """
    api_key = f"envox_{secrets.token_urlsafe(32)}"
    api_key_hash = hash_api_key(api_key)
    return api_key, api_key_hash


def hash_api_key(api_key: str) -> str:
    """Hash SHA-256 da API Key (não bcrypt — mais rápido para validação frequente)."""
    return hashlib.sha256(api_key.encode()).hexdigest()


def verify_api_key(api_key: str, stored_hash: str) -> bool:
    """Verifica API Key contra hash armazenado."""
    return hash_api_key(api_key) == stored_hash
