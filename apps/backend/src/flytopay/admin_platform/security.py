"""Admin roles, permissions, allowlist, and audit export."""

import csv
import hashlib
import io
from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from flytopay.admin.audit import record_admin_action
from flytopay.admin_platform.seed import seed_admin_permissions
from flytopay.admin_security import (
    AdminAllowlistEntry,
    AdminAuditEvent,
    AdminPermission,
    AdminPrincipal,
    AdminRole,
    require_admin_permission,
)
from flytopay.auth.csrf import verify_csrf
from flytopay.db.models import TelegramAccount
from flytopay.db.session import get_db

router = APIRouter(prefix="/api/v1/admin/system", tags=["Admin Security"])
ReadRoles = Annotated[AdminPrincipal, Depends(require_admin_permission("admin.roles.read"))]
WriteRoles = Annotated[AdminPrincipal, Depends(require_admin_permission("admin.roles.write"))]
ReadAudit = Annotated[AdminPrincipal, Depends(require_admin_permission("admin.audit.read"))]


class RoleInput(BaseModel):
    name: str = Field(min_length=2, max_length=64)
    description: str | None = Field(default=None, max_length=512)
    permissions: list[str] = Field(default_factory=list)
    is_active: bool = True


class AllowlistInput(BaseModel):
    telegram_id: int = Field(gt=0)
    role_id: UUID
    note: str | None = Field(default=None, max_length=512)


class AllowlistPatch(BaseModel):
    role_id: UUID | None = None
    is_active: bool | None = None
    note: str | None = Field(default=None, max_length=512)


def _role_payload(role: AdminRole) -> dict[str, object]:
    return {"id": str(role.id), "name": role.name, "description": role.description,
            "isActive": role.is_active, "permissions": sorted(permission.name for permission in role.permissions)}


@router.get("/permissions")
async def permissions(_: ReadRoles, db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    rows = (await db.execute(select(AdminPermission).order_by(AdminPermission.name))).scalars().all()
    return {"success": True, "data": [{"name": row.name, "description": row.description} for row in rows]}


@router.post("/permissions/seed", dependencies=[Depends(verify_csrf)])
async def seed_permissions(request: Request, principal: WriteRoles, db: Annotated[AsyncSession, Depends(get_db)],
                           idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
    if not idempotency_key:
        raise HTTPException(400, "Idempotency-Key is required")
    created = await seed_admin_permissions(db)
    key_hash = hashlib.sha256(f"{principal.user_id}:{idempotency_key}".encode()).hexdigest()
    record_admin_action(db, request, principal.user_id, "permissions.seed", principal.user_id,
                        f"Seeded {created} permissions", key_hash)
    await db.commit()
    return {"success": True, "data": {"created": created}}


@router.get("/roles")
async def roles(_: ReadRoles, db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    rows = (await db.execute(select(AdminRole).order_by(AdminRole.name))).scalars().all()
    return {"success": True, "data": [_role_payload(role) for role in rows]}


@router.post("/roles", dependencies=[Depends(verify_csrf)])
async def create_role(body: RoleInput, request: Request, principal: WriteRoles,
                      db: Annotated[AsyncSession, Depends(get_db)],
                      idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
    if not idempotency_key:
        raise HTTPException(400, "Idempotency-Key is required")
    if await db.scalar(select(AdminRole.id).where(AdminRole.name == body.name.strip())):
        raise HTTPException(409, "Role already exists")
    role = AdminRole(name=body.name.strip(), description=body.description, is_active=body.is_active)
    if body.permissions:
        role.permissions = list((await db.execute(select(AdminPermission).where(
            AdminPermission.name.in_(body.permissions)))).scalars().all())
    db.add(role)
    key_hash = hashlib.sha256(f"{principal.user_id}:{idempotency_key}".encode()).hexdigest()
    await db.flush()
    record_admin_action(db, request, principal.user_id, "role.create", role.id, f"Role {role.name}", key_hash)
    await db.commit()
    return {"success": True, "data": _role_payload(role)}


@router.patch("/roles/{role_id}", dependencies=[Depends(verify_csrf)])
async def update_role(role_id: UUID, body: RoleInput, request: Request, principal: WriteRoles,
                      db: Annotated[AsyncSession, Depends(get_db)],
                      idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
    if not idempotency_key:
        raise HTTPException(400, "Idempotency-Key is required")
    role = await db.get(AdminRole, role_id)
    if role is None:
        raise HTTPException(404, "Role not found")
    role.name, role.description, role.is_active = body.name.strip(), body.description, body.is_active
    if body.permissions == []:
        role.permissions = []
    elif body.permissions:
        role.permissions = list((await db.execute(select(AdminPermission).where(
            AdminPermission.name.in_(body.permissions)))).scalars().all())
    key_hash = hashlib.sha256(f"{principal.user_id}:{idempotency_key}".encode()).hexdigest()
    record_admin_action(db, request, principal.user_id, "role.update", role.id, f"Role {role.name}", key_hash)
    await db.commit()
    return {"success": True, "data": _role_payload(role)}


@router.get("/admins")
async def admins(_: ReadRoles, db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    rows = (await db.execute(select(AdminAllowlistEntry).order_by(AdminAllowlistEntry.telegram_id))).scalars().all()
    items = []
    for entry in rows:
        role = await db.get(AdminRole, entry.role_id)
        items.append({"id": str(entry.id), "telegramId": entry.telegram_id, "roleId": str(entry.role_id),
                      "roleName": role.name if role else None, "isActive": entry.is_active, "note": entry.note})
    return {"success": True, "data": items}


@router.post("/admins", dependencies=[Depends(verify_csrf)])
async def add_admin(body: AllowlistInput, request: Request, principal: WriteRoles,
                    db: Annotated[AsyncSession, Depends(get_db)],
                    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
    if not idempotency_key:
        raise HTTPException(400, "Idempotency-Key is required")
    if await db.get(AdminRole, body.role_id) is None:
        raise HTTPException(404, "Role not found")
    existing = await db.scalar(select(AdminAllowlistEntry).where(AdminAllowlistEntry.telegram_id == body.telegram_id))
    if existing is not None:
        existing.role_id = body.role_id
        existing.is_active = True
        existing.note = body.note
        entry = existing
    else:
        entry = AdminAllowlistEntry(telegram_id=body.telegram_id, role_id=body.role_id, note=body.note)
        db.add(entry)
        await db.flush()
    key_hash = hashlib.sha256(f"{principal.user_id}:{idempotency_key}".encode()).hexdigest()
    record_admin_action(db, request, principal.user_id, "admin.allowlist", entry.id,
                        f"Allowlist {body.telegram_id}", key_hash)
    await db.commit()
    return {"success": True, "data": {"id": str(entry.id), "telegramId": entry.telegram_id, "isActive": entry.is_active}}


@router.patch("/admins/{entry_id}", dependencies=[Depends(verify_csrf)])
async def update_admin(entry_id: UUID, body: AllowlistPatch, request: Request, principal: WriteRoles,
                       db: Annotated[AsyncSession, Depends(get_db)],
                       idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
    if not idempotency_key:
        raise HTTPException(400, "Idempotency-Key is required")
    entry = await db.get(AdminAllowlistEntry, entry_id)
    if entry is None:
        raise HTTPException(404, "Allowlist entry not found")
    if body.role_id is not None:
        if await db.get(AdminRole, body.role_id) is None:
            raise HTTPException(404, "Role not found")
        entry.role_id = body.role_id
    if body.is_active is not None:
        entry.is_active = body.is_active
    if body.note is not None:
        entry.note = body.note
    key_hash = hashlib.sha256(f"{principal.user_id}:{idempotency_key}".encode()).hexdigest()
    record_admin_action(db, request, principal.user_id, "admin.allowlist_update", entry.id,
                        f"Allowlist {entry.telegram_id}", key_hash)
    await db.commit()
    return {"success": True, "data": {"id": str(entry.id), "isActive": entry.is_active, "roleId": str(entry.role_id)}}


@router.get("/audit")
async def audit(
    _: ReadAudit,
    db: Annotated[AsyncSession, Depends(get_db)],
    action: str | None = None,
    actor: str | None = None,
    days: int = Query(30, ge=1, le=366),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, object]:
    statement = select(AdminAuditEvent).where(AdminAuditEvent.created_at >= datetime.now(UTC) - timedelta(days=days))
    if action:
        statement = statement.where(AdminAuditEvent.action.ilike(f"%{action}%"))
    if actor:
        try:
            statement = statement.where(AdminAuditEvent.actor_user_id == UUID(actor))
        except ValueError:
            telegram_id = int(actor) if actor.isdigit() else None
            if telegram_id is None:
                raise HTTPException(422, "Invalid actor filter") from None
            user_id = await db.scalar(select(TelegramAccount.user_id).where(TelegramAccount.telegram_id == telegram_id))
            statement = statement.where(AdminAuditEvent.actor_user_id == user_id)
    total = await db.scalar(select(func.count()).select_from(statement.subquery())) or 0
    rows = (await db.execute(statement.order_by(AdminAuditEvent.created_at.desc())
                             .offset((page - 1) * limit).limit(limit))).scalars().all()
    return {"success": True, "data": {"items": [{"id": str(row.id),
        "actorUserId": str(row.actor_user_id) if row.actor_user_id else None, "action": row.action,
        "resource": row.resource, "resourceId": row.resource_id,
        "reason": (row.details or {}).get("reason"),
        "ipAddress": row.ip_address, "userAgent": row.user_agent,
        "createdAt": row.created_at.isoformat()} for row in rows],
        "total": total, "page": page, "limit": limit}}


@router.get("/audit/export")
async def audit_export(
    _: ReadAudit,
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = Query(30, ge=1, le=366),
) -> Response:
    rows = (await db.execute(select(AdminAuditEvent)
                             .where(AdminAuditEvent.created_at >= datetime.now(UTC) - timedelta(days=days))
                             .order_by(AdminAuditEvent.created_at.desc()).limit(20000))).scalars().all()
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["id", "actor_user_id", "action", "resource", "resource_id", "reason", "ip_address", "created_at"])
    for row in rows:
        writer.writerow([row.id, row.actor_user_id, row.action, row.resource, row.resource_id,
                         (row.details or {}).get("reason", ""), row.ip_address or "", row.created_at.isoformat()])
    return Response(content=buffer.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="audit-{days}d.csv"'})
