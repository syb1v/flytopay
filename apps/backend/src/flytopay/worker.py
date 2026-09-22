"""Celery application entrypoint; task modules are added with domain workers."""

from celery import Celery

from flytopay.config import get_settings
from flytopay.integrations.caas2328.worker import register_celery_task as register_caas_task
from flytopay.payments.reconciliation import register_celery_task as register_reconciliation_task

celery_app = Celery("flytopay", broker=get_settings().redis_url, backend=get_settings().redis_url)
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "payments-reconcile-every-5-minutes": {
            "task": "flytopay.payments.reconcile",
            "schedule": 300.0,
        },
    },
)
register_caas_task(celery_app)
register_reconciliation_task(celery_app)
