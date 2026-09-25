"""Admin CRUD for FAQ/legal/news content, templates, and broadcasts."""

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flytopay.admin_security import AdminPrincipal, require_admin_permission
from flytopay.auth.csrf import verify_csrf
from flytopay.content.broadcasts import audience_telegram_ids, normalize_audience, queue_broadcast_for_users
from flytopay.content.models import Broadcast, BroadcastDelivery, ContentDocument, MessageTemplate
from flytopay.db.session import get_db

router = APIRouter(prefix="/api/v1/admin/content", tags=["Admin Content"])
ReadContent = Annotated[AdminPrincipal, Depends(require_admin_permission("admin.content.read"))]
WriteContent = Annotated[AdminPrincipal, Depends(require_admin_permission("admin.content.write"))]
SendBroadcasts = Annotated[AdminPrincipal, Depends(require_admin_permission("admin.broadcasts.send"))]


class ContentCreate(BaseModel):
    kind: str = Field(pattern=r"^(faq|news|legal)$")
    slug: str = Field(min_length=2, max_length=160)
    locale: str = Field(default="ru", pattern=r"^(ru|en)$")
    title: str = Field(min_length=1, max_length=255)
    body: str = Field(min_length=1, max_length=100000)
    is_published: bool = False


class TemplateCreate(BaseModel):
    key: str = Field(min_length=2, max_length=128)
    channel: str = Field(default="telegram", pattern=r"^(telegram|email)$")
    locale: str = Field(default="ru", pattern=r"^(ru|en)$")
    subject: str | None = Field(default=None, max_length=255)
    body: str = Field(min_length=1, max_length=100000)


class ContentPatch(ContentCreate):
    pass


class TemplatePatch(TemplateCreate):
    is_active: bool = True


class BroadcastInput(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    channel: Literal["telegram"] = "telegram"
    audience: dict = Field(default_factory=lambda: {"segment": "all"})
    body: str = Field(min_length=1, max_length=100000)
    scheduled_at: datetime | None = None


def _broadcast_payload(broadcast: Broadcast) -> dict[str, object]:
    return {"id": str(broadcast.id), "title": broadcast.title, "channel": broadcast.channel,
            "audience": broadcast.audience, "body": broadcast.body, "status": broadcast.status,
            "scheduledAt": broadcast.scheduled_at.isoformat() if broadcast.scheduled_at else None,
            "sentCount": broadcast.sent_count, "failedCount": broadcast.failed_count,
            "createdAt": broadcast.created_at.isoformat()}


@router.get("/documents")
async def documents(_: ReadContent, db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    rows = (await db.execute(select(ContentDocument).order_by(ContentDocument.updated_at.desc()))).scalars().all()
    return {"success": True, "data": [{"id": str(row.id), "kind": row.kind, "slug": row.slug, "locale": row.locale, "title": row.title, "body": row.body, "isPublished": row.is_published} for row in rows]}


@router.post("/documents", dependencies=[Depends(verify_csrf)])
async def create_document(body: ContentCreate, _: WriteContent, db: Annotated[AsyncSession, Depends(get_db)], idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
    if not idempotency_key:
        raise HTTPException(400, "Idempotency-Key is required")
    document = ContentDocument(**body.model_dump())
    db.add(document)
    try:
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(409, "Document slug already exists") from exc
    return {"success": True, "data": {"id": str(document.id), "slug": document.slug}}


@router.patch("/documents/{document_id}", dependencies=[Depends(verify_csrf)])
async def update_document(document_id: UUID, body: ContentPatch, _: WriteContent, db: Annotated[AsyncSession, Depends(get_db)], idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
    if not idempotency_key:
        raise HTTPException(400, "Idempotency-Key is required")
    document = await db.get(ContentDocument, document_id)
    if document is None:
        raise HTTPException(404, "Document not found")
    for key, value in body.model_dump().items():
        setattr(document, key, value)
    await db.commit()
    return {"success": True, "data": {"id": str(document.id), "slug": document.slug, "isPublished": document.is_published}}


@router.delete("/documents/{document_id}", dependencies=[Depends(verify_csrf)])
async def delete_document(document_id: UUID, _: WriteContent, db: Annotated[AsyncSession, Depends(get_db)], idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
    if not idempotency_key:
        raise HTTPException(400, "Idempotency-Key is required")
    document = await db.get(ContentDocument, document_id)
    if document is None:
        raise HTTPException(404, "Document not found")
    await db.delete(document)
    await db.commit()
    return {"success": True, "data": {"id": str(document_id), "deleted": True}}


@router.get("/templates")
async def templates(_: ReadContent, db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    rows = (await db.execute(select(MessageTemplate).order_by(MessageTemplate.key))).scalars().all()
    return {"success": True, "data": [{"id": str(row.id), "key": row.key, "channel": row.channel, "locale": row.locale, "subject": row.subject, "body": row.body, "isActive": row.is_active} for row in rows]}


@router.post("/templates", dependencies=[Depends(verify_csrf)])
async def create_template(body: TemplateCreate, _: WriteContent, db: Annotated[AsyncSession, Depends(get_db)], idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
    if not idempotency_key:
        raise HTTPException(400, "Idempotency-Key is required")
    template = MessageTemplate(**body.model_dump())
    db.add(template)
    try:
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(409, "Template key already exists") from exc
    return {"success": True, "data": {"id": str(template.id), "key": template.key}}


@router.patch("/templates/{template_id}", dependencies=[Depends(verify_csrf)])
async def update_template(template_id: UUID, body: TemplatePatch, _: WriteContent, db: Annotated[AsyncSession, Depends(get_db)], idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
    if not idempotency_key:
        raise HTTPException(400, "Idempotency-Key is required")
    template = await db.get(MessageTemplate, template_id)
    if template is None:
        raise HTTPException(404, "Template not found")
    for key, value in body.model_dump().items():
        setattr(template, key, value)
    await db.commit()
    return {"success": True, "data": {"id": str(template.id), "key": template.key, "isActive": template.is_active}}


@router.get("/broadcasts")
async def broadcasts(_: ReadContent, db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    rows = (await db.execute(select(Broadcast).order_by(Broadcast.created_at.desc()))).scalars().all()
    return {"success": True, "data": [_broadcast_payload(row) for row in rows]}


@router.post("/broadcasts", dependencies=[Depends(verify_csrf)])
async def create_broadcast(body: BroadcastInput, _: WriteContent, db: Annotated[AsyncSession, Depends(get_db)], idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
    if not idempotency_key:
        raise HTTPException(400, "Idempotency-Key is required")
    broadcast = Broadcast(title=body.title.strip(), channel=body.channel,
                          audience=normalize_audience(body.audience), body=body.body,
                          scheduled_at=body.scheduled_at, status="scheduled" if body.scheduled_at else "draft")
    db.add(broadcast)
    await db.commit()
    return {"success": True, "data": _broadcast_payload(broadcast)}


@router.patch("/broadcasts/{broadcast_id}", dependencies=[Depends(verify_csrf)])
async def update_broadcast(broadcast_id: UUID, body: BroadcastInput, _: WriteContent, db: Annotated[AsyncSession, Depends(get_db)], idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
    if not idempotency_key:
        raise HTTPException(400, "Idempotency-Key is required")
    broadcast = await db.get(Broadcast, broadcast_id)
    if broadcast is None:
        raise HTTPException(404, "Broadcast not found")
    if broadcast.status not in {"draft", "scheduled"}:
        raise HTTPException(409, "Sent broadcasts cannot be edited")
    broadcast.title = body.title.strip()
    broadcast.audience = normalize_audience(body.audience)
    broadcast.body = body.body
    broadcast.scheduled_at = body.scheduled_at
    broadcast.status = "scheduled" if body.scheduled_at else "draft"
    await db.commit()
    return {"success": True, "data": _broadcast_payload(broadcast)}


@router.post("/broadcasts/{broadcast_id}/preview")
async def preview_broadcast(broadcast_id: UUID, _: ReadContent, db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    broadcast = await db.get(Broadcast, broadcast_id)
    if broadcast is None:
        raise HTTPException(404, "Broadcast not found")
    recipients = await audience_telegram_ids(db, broadcast.audience)
    return {"success": True, "data": {"title": broadcast.title, "body": broadcast.body,
        "audience": normalize_audience(broadcast.audience), "recipients": len(recipients)}}


@router.post("/broadcasts/{broadcast_id}/send", dependencies=[Depends(verify_csrf)])
async def send_broadcast(broadcast_id: UUID, principal: SendBroadcasts, db: Annotated[AsyncSession, Depends(get_db)], idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
    if not idempotency_key:
        raise HTTPException(400, "Idempotency-Key is required")
    broadcast = await db.get(Broadcast, broadcast_id)
    if broadcast is None:
        raise HTTPException(404, "Broadcast not found")
    if broadcast.status not in {"draft", "scheduled"}:
        raise HTTPException(409, "Broadcast is already queued or sent")
    recipients = await queue_broadcast_for_users(db, broadcast)
    broadcast.status = "queued"
    broadcast.scheduled_at = None
    await db.commit()
    from flytopay.worker import celery_app

    celery_app.send_task("flytopay.broadcast.send", kwargs={"broadcast_id": str(broadcast.id)})
    return {"success": True, "data": {"id": str(broadcast.id), "status": broadcast.status, "queued": recipients}}


@router.get("/broadcasts/{broadcast_id}/deliveries")
async def broadcast_deliveries(broadcast_id: UUID, _: ReadContent, db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    rows = (await db.execute(select(BroadcastDelivery).where(BroadcastDelivery.broadcast_id == broadcast_id)
                             .order_by(BroadcastDelivery.created_at.desc()).limit(500))).scalars().all()
    return {"success": True, "data": [{"id": str(row.id), "userId": str(row.user_id), "status": row.status,
        "error": row.error, "createdAt": row.created_at.isoformat()} for row in rows]}
