"""Worker-facing polling primitives; callers decide scheduling and persistence."""

from .lifecycle import NormalizedOperation
from .service import CaaSCardLifecycleService


async def poll_order(service: CaaSCardLifecycleService, order_id: str) -> NormalizedOperation:
    """Fetch one order state; return it for a scheduler to retry while non-terminal."""
    return await service.order(order_id)


def register_celery_task(celery_app):
    """Register an explicit task factory without importing or changing the app entrypoint."""
    @celery_app.task(name="flytopay.caas.poll_order")
    def poll_order_task(order_id: str) -> str:
        return order_id

    return poll_order_task
