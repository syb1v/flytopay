"""Guard against event-loop connection leaks in Celery task paths."""

from pathlib import Path

from flytopay import worker
from flytopay.cards import lifecycle_routes
from flytopay.db.session import task_session
from flytopay.payments import reconciliation

TASK_MODULES = (worker, lifecycle_routes, reconciliation)


def test_task_session_is_a_context_manager_factory():
    assert callable(task_session)
    assert hasattr(task_session, "__wrapped__"), "task_session must be @asynccontextmanager"


def test_celery_task_paths_do_not_use_the_shared_engine():
    """Celery runs each task under a new event loop; the shared pooled engine leaks
    one asyncpg connection per run (production incident: Postgres hit max_connections
    and refused all clients). Task paths must use the disposable NullPool session."""
    for module in TASK_MODULES:
        source = Path(module.__file__).read_text()
        assert "session_factory()" not in source, f"{module.__name__} must not open the shared engine"
        assert "task_session()" in source, f"{module.__name__} must use task_session()"
