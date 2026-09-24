"""Safe audit records for administrator changes."""

from uuid import UUID

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from flytopay.admin_security.models import AdminAuditEvent


def record_admin_action(
    db: AsyncSession, request: Request, actor_id: UUID, action: str, target_id: UUID,
    reason: str, key_hash: str, revoked_sessions: int = 0,
) -> None:
    db.add(AdminAuditEvent(
        actor_user_id=actor_id, action=action, resource="user", resource_id=str(target_id),
        details={"reason": reason, "idempotency_hash": key_hash, "revoked_sessions": revoked_sessions},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent", "")[:512],
    ))
