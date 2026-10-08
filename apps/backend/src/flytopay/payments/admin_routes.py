"""Admin endpoints for payment provider availability toggles."""

import hashlib
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flytopay.admin.audit import record_admin_action
from flytopay.admin_platform.models import SystemSetting
from flytopay.admin_security import AdminPrincipal, require_admin_permission
from flytopay.auth.csrf import verify_csrf
from flytopay.db.session import get_db
from flytopay.payments.provider_settings import PROVIDER_CATALOG, _setting_key, provider_status

router = APIRouter(prefix="/api/v1/admin/payments", tags=["Admin Payments"])
ReadPayments = Annotated[AdminPrincipal, Depends(require_admin_permission("admin.sales.read"))]
WritePayments = Annotated[AdminPrincipal, Depends(require_admin_permission("admin.payments.write"))]


class ProviderToggle(BaseModel):
    enabled: bool


@router.get("/providers")
async def providers(_: ReadPayments, db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    return {"success": True, "data": await provider_status(db)}


@router.put("/providers/{provider}", dependencies=[Depends(verify_csrf)])
async def toggle_provider(
    provider: str,
    body: ProviderToggle,
    request: Request,
    principal: WritePayments,
    db: Annotated[AsyncSession, Depends(get_db)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> dict[str, object]:
    if provider not in PROVIDER_CATALOG:
        raise HTTPException(404, "Unknown payment provider")
    if not idempotency_key:
        raise HTTPException(400, "Idempotency-Key is required")
    key = _setting_key(provider)
    setting = await db.scalar(select(SystemSetting).where(SystemSetting.key == key))
    value = {"enabled": body.enabled}
    if setting is None:
        setting = SystemSetting(key=key, value=value, description=PROVIDER_CATALOG[provider]["title"],
                                is_public_business_setting=False)
        db.add(setting)
    else:
        setting.value = value
    key_hash = hashlib.sha256(f"{principal.user_id}:{idempotency_key}".encode()).hexdigest()
    record_admin_action(db, request, principal.user_id, "payment_provider.toggle", setting.id,
                        f"{provider}: {'включён' if body.enabled else 'отключён'}", key_hash)
    await db.commit()
    return {"success": True, "data": {"key": provider, "enabled": body.enabled}}
