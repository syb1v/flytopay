"""FastAPI dependencies for permission-based admin authorization."""

from collections.abc import Callable
from dataclasses import dataclass
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from flytopay.admin_security.bootstrap import is_bootstrap_owner
from flytopay.admin_security.models import AdminAllowlistEntry, AdminPermission, AdminRole, admin_user_roles
from flytopay.auth.session import current_user_id
from flytopay.db.models import TelegramAccount
from flytopay.db.session import get_db


@dataclass(frozen=True)
class AdminPrincipal:
    user_id: UUID
    telegram_id: int
    is_bootstrap_owner: bool = False


async def admin_principal(
    user_id: Annotated[UUID, Depends(current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AdminPrincipal:
    telegram_id = await db.scalar(
        select(TelegramAccount.telegram_id).where(TelegramAccount.user_id == user_id)
    )
    if telegram_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    if is_bootstrap_owner(telegram_id):
        return AdminPrincipal(user_id, telegram_id, True)

    allowlisted = await db.scalar(
        select(AdminAllowlistEntry.id).where(
            AdminAllowlistEntry.telegram_id == telegram_id,
            AdminAllowlistEntry.is_active.is_(True),
        )
    )
    if allowlisted is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return AdminPrincipal(user_id, telegram_id)


async def _has_permission(principal: AdminPrincipal, permission: str, db: AsyncSession) -> bool:
    if principal.is_bootstrap_owner:
        return True
    role_ids = select(admin_user_roles.c.role_id).where(admin_user_roles.c.user_id == principal.user_id)
    allowlist_role_ids = select(AdminAllowlistEntry.role_id).where(
        AdminAllowlistEntry.telegram_id == principal.telegram_id,
        AdminAllowlistEntry.is_active.is_(True),
    )
    statement = select(AdminPermission.id).join(AdminRole.permissions).where(
        AdminRole.is_active.is_(True),
        AdminPermission.name == permission,
        or_(AdminRole.id.in_(role_ids), AdminRole.id.in_(allowlist_role_ids)),
    )
    return await db.scalar(statement) is not None


def require_admin_permission(permission: str) -> Callable:
    """Build a FastAPI dependency requiring one named admin permission."""

    async def dependency(
        principal: Annotated[AdminPrincipal, Depends(admin_principal)],
        db: Annotated[AsyncSession, Depends(get_db)],
    ) -> AdminPrincipal:
        if not await _has_permission(principal, permission, db):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin permission required")
        return principal

    return dependency


__all__ = ["AdminPrincipal", "admin_principal", "require_admin_permission"]
