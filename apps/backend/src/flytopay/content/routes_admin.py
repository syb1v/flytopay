"""Admin CRUD for FAQ/legal/news content and message templates."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flytopay.admin_security import AdminPrincipal, require_admin_permission
from flytopay.auth.csrf import verify_csrf
from flytopay.content.models import Broadcast, ContentDocument, MessageTemplate
from flytopay.db.session import get_db

router = APIRouter(prefix="/api/v1/admin/content", tags=["Admin Content"])
ReadContent = Annotated[AdminPrincipal, Depends(require_admin_permission("admin.content.read"))]


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


@router.get("/documents")
async def documents(_: ReadContent, db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    rows = (await db.execute(select(ContentDocument).order_by(ContentDocument.updated_at.desc()))).scalars().all()
    return {"success": True, "data": [{"id": str(row.id), "kind": row.kind, "slug": row.slug, "locale": row.locale, "title": row.title, "body": row.body, "isPublished": row.is_published} for row in rows]}


@router.post("/documents", dependencies=[Depends(verify_csrf)])
async def create_document(body: ContentCreate, _: Annotated[AdminPrincipal, Depends(require_admin_permission("admin.content.write"))], db: Annotated[AsyncSession, Depends(get_db)], idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
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
async def update_document(document_id: UUID, body: ContentPatch, _: Annotated[AdminPrincipal, Depends(require_admin_permission("admin.content.write"))], db: Annotated[AsyncSession, Depends(get_db)], idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
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
async def delete_document(document_id: UUID, _: Annotated[AdminPrincipal, Depends(require_admin_permission("admin.content.write"))], db: Annotated[AsyncSession, Depends(get_db)], idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
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
async def create_template(body: TemplateCreate, _: Annotated[AdminPrincipal, Depends(require_admin_permission("admin.content.write"))], db: Annotated[AsyncSession, Depends(get_db)], idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
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
async def update_template(template_id: UUID, body: TemplatePatch, _: Annotated[AdminPrincipal, Depends(require_admin_permission("admin.content.write"))], db: Annotated[AsyncSession, Depends(get_db)], idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
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
    return {"success": True, "data": [{"id": str(row.id), "title": row.title, "channel": row.channel, "audience": row.audience, "status": row.status, "scheduledAt": row.scheduled_at.isoformat() if row.scheduled_at else None, "sentCount": row.sent_count, "failedCount": row.failed_count} for row in rows]}
