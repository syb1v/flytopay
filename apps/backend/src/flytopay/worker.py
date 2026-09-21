"""Celery application entrypoint; task modules are added with domain workers."""

from celery import Celery

from flytopay.config import get_settings

celery_app = Celery("flytopay", broker=get_settings().redis_url, backend=get_settings().redis_url)
celery_app.conf.update(task_serializer="json", accept_content=["json"], result_serializer="json", timezone="UTC", enable_utc=True)
