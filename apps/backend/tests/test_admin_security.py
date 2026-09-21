from uuid import uuid4

import pytest

from flytopay.admin_security.bootstrap import is_bootstrap_owner
from flytopay.admin_security.dependencies import AdminPrincipal, _has_permission
from flytopay.admin_security.models import (
    AdminAllowlistEntry,
    AdminAuditEvent,
    AdminPermission,
    AdminRole,
)


def test_bootstrap_owner_uses_telegram_admin_ids(monkeypatch):
    monkeypatch.setenv("TELEGRAM_ADMIN_IDS", "123, 456, invalid")
    from flytopay.config import get_settings

    get_settings.cache_clear()
    assert is_bootstrap_owner(123)
    assert is_bootstrap_owner(456)
    assert not is_bootstrap_owner(789)
    assert not is_bootstrap_owner(None)


def test_security_models_are_registered():
    assert AdminRole.__tablename__ == "admin_roles"
    assert AdminPermission.__tablename__ == "admin_permissions"
    assert AdminAllowlistEntry.__tablename__ == "admin_allowlist"
    assert AdminAuditEvent.__tablename__ == "admin_audit_events"


@pytest.mark.asyncio
async def test_bootstrap_owner_bypasses_database_permission():
    principal = AdminPrincipal(uuid4(), 123, True)
    assert await _has_permission(principal, "anything", object())


@pytest.mark.asyncio
async def test_non_owner_without_permission_is_denied(monkeypatch):
    class EmptyDb:
        async def scalar(self, _statement):
            return None

    principal = AdminPrincipal(uuid4(), 123)
    assert not await _has_permission(principal, "admin.read", EmptyDb())


def test_permission_dependency_is_callable():
    from flytopay.admin_security import require_admin_permission

    assert callable(require_admin_permission("admin.read"))
