"""Idempotent bootstrap of the canonical admin permissions."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flytopay.admin_platform.permissions import ADMIN_PERMISSIONS
from flytopay.admin_security.models import AdminPermission


async def seed_admin_permissions(db: AsyncSession) -> int:
    existing = set((await db.scalars(select(AdminPermission.name))).all())
    created = 0
    for name, description in ADMIN_PERMISSIONS:
        if name not in existing:
            db.add(AdminPermission(name=name, description=description))
            created += 1
    if created:
        await db.flush()
    return created
