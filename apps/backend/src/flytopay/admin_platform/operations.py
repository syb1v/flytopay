"""Feature flags, settings, errors, webhook replay, and maintenance controls."""

import hashlib
import re
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from flytopay.admin.audit import record_admin_action
from flytopay.admin_platform.maintenance import set_maintenance_state
from flytopay.admin_platform.models import AdminErrorEvent, FeatureFlag, SystemSetting
from flytopay.admin_security import AdminPrincipal, require_admin_permission
from flytopay.auth.csrf import verify_csrf
from flytopay.db.session import get_db
from flytopay.payments.models import PaymentAttempt, PaymentProviderEvent

router = APIRouter(prefix="/api/v1/admin/system", tags=["Admin System"])
ReadSystem = Annotated[AdminPrincipal, Depends(require_admin_permission("admin.system.read"))]
WriteSystem = Annotated[AdminPrincipal, Depends(require_admin_permission("admin.system.write"))]

SECRET_LIKE = re.compile(r"(secret|token|password|passwd|pwd|apikey|api_key|private)", re.IGNORECASE)


class FeatureFlagInput(BaseModel):
    description: str | None = Field(default=None, max_length=512)
    enabled: bool
    config: dict = Field(default_factory=dict)


class SettingInput(BaseModel):
    value: dict = Field(default_factory=dict)
    description: str | None = Field(default=None, max_length=512)
    is_public_business_setting: bool = False


class MaintenanceInput(BaseModel):
    enabled: bool
    message: str = Field(default="Технические работы", max_length=500)


def _flag_payload(flag: FeatureFlag) -> dict[str, object]:
    return {"key": flag.key, "description": flag.description, "enabled": flag.enabled, "config": flag.config}


def _setting_payload(setting: SystemSetting) -> dict[str, object]:
    return {"key": setting.key, "value": setting.value, "description": setting.description,
            "isPublicBusinessSetting": setting.is_public_business_setting}


@router.get("/feature-flags")
async def feature_flags(_: ReadSystem, db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    rows = (await db.execute(select(FeatureFlag).order_by(FeatureFlag.key))).scalars().all()
    return {"success": True, "data": [_flag_payload(row) for row in rows]}


@router.put("/feature-flags/{key}", dependencies=[Depends(verify_csrf)])
async def upsert_feature_flag(key: str, body: FeatureFlagInput, request: Request, principal: WriteSystem,
                              db: Annotated[AsyncSession, Depends(get_db)],
                              idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
    if not idempotency_key:
        raise HTTPException(400, "Idempotency-Key is required")
    if not re.fullmatch(r"[a-z0-9_.-]{2,128}", key):
        raise HTTPException(422, "Invalid feature flag key")
    flag = await db.scalar(select(FeatureFlag).where(FeatureFlag.key == key))
    if flag is None:
        flag = FeatureFlag(key=key, description=body.description, enabled=body.enabled, config=body.config)
        db.add(flag)
    else:
        flag.description, flag.enabled, flag.config = body.description, body.enabled, body.config
    key_hash = hashlib.sha256(f"{principal.user_id}:{idempotency_key}".encode()).hexdigest()
    record_admin_action(db, request, principal.user_id, "feature_flag.upsert", flag.id,
                        f"Feature flag {key}", key_hash)
    await db.commit()
    return {"success": True, "data": _flag_payload(flag)}


@router.get("/settings")
async def settings(_: ReadSystem, db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    rows = (await db.execute(select(SystemSetting).order_by(SystemSetting.key))).scalars().all()
    return {"success": True, "data": [_setting_payload(row) for row in rows]}


@router.put("/settings/{key}", dependencies=[Depends(verify_csrf)])
async def upsert_setting(key: str, body: SettingInput, request: Request, principal: WriteSystem,
                         db: Annotated[AsyncSession, Depends(get_db)],
                         idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
    if not idempotency_key:
        raise HTTPException(400, "Idempotency-Key is required")
    if not re.fullmatch(r"[a-z0-9_.-]{2,128}", key):
        raise HTTPException(422, "Invalid setting key")
    if SECRET_LIKE.search(key):
        raise HTTPException(422, "Secret-like settings cannot be stored from the admin UI")
    setting = await db.scalar(select(SystemSetting).where(SystemSetting.key == key))
    if setting is None:
        setting = SystemSetting(key=key, value=body.value, description=body.description,
                                is_public_business_setting=body.is_public_business_setting)
        db.add(setting)
    else:
        setting.value = body.value
        setting.description = body.description
        setting.is_public_business_setting = body.is_public_business_setting
    key_hash = hashlib.sha256(f"{principal.user_id}:{idempotency_key}".encode()).hexdigest()
    record_admin_action(db, request, principal.user_id, "system.setting_upsert", setting.id,
                        f"Setting {key}", key_hash)
    await db.commit()
    return {"success": True, "data": _setting_payload(setting)}


@router.get("/errors")
async def errors(
    _: ReadSystem,
    db: Annotated[AsyncSession, Depends(get_db)],
    severity: str | None = None,
    source: str | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, object]:
    statement = select(AdminErrorEvent)
    if severity:
        statement = statement.where(AdminErrorEvent.severity == severity)
    if source:
        statement = statement.where(AdminErrorEvent.source == source)
    total = await db.scalar(select(func.count()).select_from(statement.subquery())) or 0
    rows = (await db.execute(statement.order_by(AdminErrorEvent.created_at.desc())
                             .offset((page - 1) * limit).limit(limit))).scalars().all()
    return {"success": True, "data": {"items": [{"id": str(row.id), "source": row.source,
        "severity": row.severity, "message": row.message, "correlationId": row.correlation_id,
        "context": row.context, "createdAt": row.created_at.isoformat()} for row in rows],
        "total": total, "page": page, "limit": limit}}


@router.get("/webhooks")
async def webhooks(
    _: ReadSystem,
    db: Annotated[AsyncSession, Depends(get_db)],
    status: str | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, object]:
    statement = select(PaymentProviderEvent)
    if status:
        statement = statement.where(PaymentProviderEvent.processing_status == status)
    total = await db.scalar(select(func.count()).select_from(statement.subquery())) or 0
    rows = (await db.execute(statement.order_by(PaymentProviderEvent.created_at.desc())
                             .offset((page - 1) * limit).limit(limit))).scalars().all()
    return {"success": True, "data": {"items": [{"id": str(row.id), "provider": row.provider,
        "eventType": row.event_type, "status": row.processing_status,
        "deduplicationKey": row.deduplication_key[:12],
        "createdAt": row.created_at.isoformat()} for row in rows], "total": total,
        "page": page, "limit": limit}}


@router.post("/webhooks/{event_id}/requeue", dependencies=[Depends(verify_csrf)])
async def requeue_webhook(event_id: UUID, request: Request, principal: WriteSystem,
                          db: Annotated[AsyncSession, Depends(get_db)],
                          idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
    if not idempotency_key:
        raise HTTPException(400, "Idempotency-Key is required")
    event = await db.get(PaymentProviderEvent, event_id)
    if event is None:
        raise HTTPException(404, "Event not found")
    if event.processing_status not in {"finalize_failed", "failed", "received"}:
        raise HTTPException(409, "Only failed events can be requeued")
    payload = event.payload or {}
    payment_id = payload.get("providerPaymentId") or payload.get("paymentId") or payload.get("id")
    attempt = None
    if payment_id:
        attempt = await db.scalar(select(PaymentAttempt).where(
            PaymentAttempt.provider == event.provider,
            PaymentAttempt.provider_payment_id == str(payment_id)))
    if attempt is None:
        raise HTTPException(409, "No linked payment attempt to reconcile")
    attempt.status = "reconcile_required"
    event.processing_status = "requeued"
    key_hash = hashlib.sha256(f"{principal.user_id}:{idempotency_key}".encode()).hexdigest()
    record_admin_action(db, request, principal.user_id, "webhook.requeue", event.id,
                        f"Webhook {event.provider} requeued", key_hash)
    await db.commit()
    from flytopay.worker import celery_app

    celery_app.send_task("flytopay.payments.reconcile")
    return {"success": True, "data": {"id": str(event.id), "status": event.processing_status,
                                      "attemptId": str(attempt.id)}}


@router.get("/maintenance")
async def maintenance_state(_: ReadSystem) -> dict[str, object]:
    from flytopay.admin_platform.maintenance import get_maintenance_state

    message = await get_maintenance_state()
    return {"success": True, "data": {"enabled": message is not None, "message": message}}


@router.put("/maintenance", dependencies=[Depends(verify_csrf)])
async def update_maintenance(body: MaintenanceInput, request: Request, principal: WriteSystem,
                             db: Annotated[AsyncSession, Depends(get_db)],
                             idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
    if not idempotency_key:
        raise HTTPException(400, "Idempotency-Key is required")
    await set_maintenance_state(body.enabled, body.message)
    setting = await db.scalar(select(SystemSetting).where(SystemSetting.key == "maintenance_mode"))
    value = {"enabled": body.enabled, "message": body.message}
    if setting is None:
        setting = SystemSetting(key="maintenance_mode", value=value,
                                description="Maintenance mode flag", is_public_business_setting=False)
        db.add(setting)
    else:
        setting.value = value
    key_hash = hashlib.sha256(f"{principal.user_id}:{idempotency_key}".encode()).hexdigest()
    record_admin_action(db, request, principal.user_id, "system.maintenance", setting.id,
                        body.message if body.enabled else "Maintenance disabled", key_hash)
    await db.commit()
    return {"success": True, "data": value}
