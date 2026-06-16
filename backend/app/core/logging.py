"""
Configuração de logging estruturado com structlog.
Logs em formato JSON em produção, coloridos em desenvolvimento.
"""
import logging
import sys
import structlog
from app.core.config import settings


def setup_logging() -> None:
    """Configura o sistema de logging da aplicação."""

    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

    # Configura o logging padrão do Python
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=log_level,
    )

    # Silencia logs muito verbosos de libs externas
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

    # Processors comuns
    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.StackInfoRenderer(),
    ]

    if settings.is_production:
        # JSON em produção — fácil de parsear por ferramentas de observabilidade
        processors = shared_processors + [
            structlog.processors.dict_tracebacks,
            structlog.processors.JSONRenderer(),
        ]
    else:
        # Colorido e legível em desenvolvimento
        processors = shared_processors + [
            structlog.dev.ConsoleRenderer(colors=True),
        ]

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    """Retorna um logger nomeado para o módulo."""
    return structlog.get_logger(name)
