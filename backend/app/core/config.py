"""
Configurações centrais da aplicação ENVOX Intelligence.
Todas as configurações vêm de variáveis de ambiente (.env).
"""
from typing import Optional, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # === APP ===
    APP_NAME: str = "ENVOX Intelligence"
    APP_VERSION: str = "0.1.0"
    APP_ENV: str = "development"  # development | production
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    # === BANCO DE DADOS ===
    DATABASE_URL: str = "postgresql+asyncpg://envox:envox123@localhost:5432/envox_intel"
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20
    AUTO_MIGRATE: bool = True  # Roda alembic upgrade head no startup

    # === SEGURANÇA ===
    SECRET_KEY: str = "CHANGE_THIS_IN_PRODUCTION_USE_64_RANDOM_CHARS"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8  # 8 horas

    # API Key para ingestão externa (hash bcrypt)
    API_KEY_SECRET: str = "envox-default-api-key-change-in-production"

    # === CORS ===
    # Aceita string separada por vírgula ou lista JSON no .env
    ALLOWED_ORIGINS: Union[list[str], str] = ["http://localhost:3000", "http://localhost:8000"]

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_allowed_origins(cls, v):
        if isinstance(v, str):
            # Remove colchetes se vier como JSON string
            v = v.strip().strip("[]")
            # Divide por vírgula e limpa espaços e aspas
            return [
                o.strip().strip('"').strip("'")
                for o in v.split(",")
                if o.strip().strip('"').strip("'")
            ]
        return v

    # === ANÁLISE ===
    DATA_RETENTION_DAYS: int = 90
    SUMMARY_SCHEDULE_HOUR: int = 6   # Job de resumo diário às 06h
    SUMMARY_SCHEDULE_MINUTE: int = 0
    ALERT_SCAN_INTERVAL_MIN: int = 15  # Scan de alertas a cada 15 min
    METRICS_UPDATE_INTERVAL_MIN: int = 30

    # Thresholds de alerta configuráveis
    ALERT_RISK_THRESHOLD: int = 65       # Score de risco >= 65 → alerta
    ALERT_CRITICAL_THRESHOLD: int = 85   # Score de risco >= 85 → crítico
    ALERT_OPPORTUNITY_THRESHOLD: int = 60
    FOLLOWUP_OVERDUE_HOURS: int = 4      # Follow-up sem resposta em 4h = alerta
    SLA_DEFAULT_MINUTES: int = 60        # SLA padrão de resposta: 60 min

    # === WPPCONNECT SERVER ===
    WPP_BASE_URL: str = "http://localhost:21465"
    WPP_SESSION: str = "termonitor"
    WPP_SECRET: str = "THISISMYSECURETOKEN"
    WPP_WEBHOOK_URL: str = "https://intel.envox.com.br/api/v1/webhooks/wppconnect"
    WPP_AUTO_RECONNECT: bool = True
    WPP_HEALTH_CHECK_INTERVAL_MIN: int = 5

    # === IA (OPCIONAL) ===
    LLM_ENABLED: bool = False
    # Anthropic (prioridade para análise e visão)
    ANTHROPIC_API_KEY: Optional[str] = None
    ANTHROPIC_MODEL: str = "claude-sonnet-4-6"
    # OpenAI (fallback / Whisper para áudio)
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4o-mini"
    # Groq (Whisper rápido e gratuito para áudio)
    GROQ_API_KEY: Optional[str] = None
    VISION_MODEL_GROQ: str = "meta-llama/llama-4-scout-17b-16e-instruct"
    VISION_MODEL_OPENAI: str = "gpt-4o-mini"
    LLM_SUMMARY_MAX_TOKENS: int = 500

    # === ADMIN PADRÃO (criado no startup se não existir) ===
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "admin123"  # TROCAR EM PRODUÇÃO

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @property
    def is_development(self) -> bool:
        return self.APP_ENV == "development"


# Instância global de configurações
settings = Settings()
