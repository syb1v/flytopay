"""Guards against provider contract drift and Celery connection leaks."""

from pathlib import Path

from flytopay import worker
from flytopay.cards import lifecycle_routes
from flytopay.catalog import routes_admin as catalog_routes
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


def test_catalog_quotes_use_the_documented_operation_value():
    """2328 accepts operation=issue|fund|unload; 'issuance' returns 422 and would
    silently blank the provider cost shown to admins."""
    source = Path(catalog_routes.__file__).read_text()
    assert 'operation="issuance"' not in source
    assert 'operation="issue"' in source


def test_suggested_retail_applies_markup_over_cost():
    from flytopay.catalog.routes_admin import suggested_retail_minor

    assert suggested_retail_minor(300, 0) == 300
    assert suggested_retail_minor(300, 2000) == 360
    assert suggested_retail_minor(300, 2500) == 375
    assert suggested_retail_minor(333, 1000) == 367
