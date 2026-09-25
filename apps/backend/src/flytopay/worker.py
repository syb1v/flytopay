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
        "caas-poll-issues-every-30-seconds": {
            "task": "flytopay.caas.poll_issues",
            "schedule": 30.0,
        },
        "caas-poll-closes-every-30-seconds": {
            "task": "flytopay.caas.poll_closes",
            "schedule": 30.0,
        },
    },
)
register_caas_task(celery_app)
register_reconciliation_task(celery_app)


@celery_app.task(name="flytopay.caas.lifecycle")
def caas_lifecycle_task(operation_key: str, card_id: str, kind: str) -> str:
    import asyncio

    from flytopay.cards.lifecycle_routes import execute_lifecycle

    return asyncio.run(execute_lifecycle(operation_key, card_id, kind))


@celery_app.task(name="flytopay.caas.poll_issues")
def caas_poll_issues_task() -> int:
    import asyncio

    from flytopay.cards.issuance import poll_pending_issues
    from flytopay.db.session import session_factory

    async def run() -> int:
        async with session_factory() as db:
            return await poll_pending_issues(db)

    return asyncio.run(run())


@celery_app.task(name="flytopay.caas.poll_closes")
def caas_poll_closes_task() -> int:
    import asyncio

    from flytopay.cards.lifecycle_routes import poll_pending_closes
    from flytopay.db.session import session_factory

    async def run() -> int:
        async with session_factory() as db:
            return await poll_pending_closes(db)

    return asyncio.run(run())


@celery_app.task(name="flytopay.broadcast.send")
def broadcast_send_task(broadcast_id: str) -> dict[str, int]:
    import asyncio

    from flytopay.content.broadcasts import send_broadcast
    from flytopay.db.session import session_factory

    async def run() -> dict[str, int]:
        async with session_factory() as db:
            return await send_broadcast(db, broadcast_id)

    return asyncio.run(run())
