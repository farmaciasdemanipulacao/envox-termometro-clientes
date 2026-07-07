"""
Models do banco de dados ENVOX Intelligence.
Importar todos aqui para que o Alembic os detecte.
"""
from app.models.source import IngestionSource
from app.models.conversation import Conversation
from app.models.participant import Participant
from app.models.message import Message
from app.models.alert import AlertEvent
from app.models.summary import DailySummary
from app.models.followup import FollowUpItem
from app.models.metrics import CollaboratorMetric, ConversationMetric
from app.models.processing import ProcessingRun
from app.models.user import User
from app.models.tenant import TenantConfig
from app.models.plan import Plan
from app.models.subscription import Subscription
from app.models.automation import ScheduledJobConfig, SystemSetting, CustomAlertRule
from app.models.custom_analysis import CustomAnalysisRun

__all__ = [
    "IngestionSource",
    "Conversation",
    "Participant",
    "Message",
    "AlertEvent",
    "DailySummary",
    "FollowUpItem",
    "CollaboratorMetric",
    "ConversationMetric",
    "ProcessingRun",
    "User",
    "TenantConfig",
    "Plan",
    "Subscription",
    "ScheduledJobConfig",
    "SystemSetting",
    "CustomAlertRule",
    "CustomAnalysisRun",
]
