"""Isolated admin authorization primitives."""

from flytopay.admin_security.dependencies import (
    AdminPrincipal,
    admin_principal,
    require_admin_permission,
)
from flytopay.admin_security.models import (
    AdminAllowlistEntry,
    AdminAuditEvent,
    AdminPermission,
    AdminRole,
    admin_role_permissions,
    admin_user_roles,
)

__all__ = [
    "AdminAllowlistEntry",
    "AdminAuditEvent",
    "AdminPermission",
    "AdminPrincipal",
    "AdminRole",
    "admin_principal",
    "admin_role_permissions",
    "admin_user_roles",
    "require_admin_permission",
]
