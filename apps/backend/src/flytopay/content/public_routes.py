"""Public, read-only content endpoints for the cabinet (FAQ and legal documents)."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flytopay.content.models import ContentDocument
from flytopay.db.session import get_db

router = APIRouter(prefix="/api/v1/content", tags=["Content"])


@router.get("/faq")
async def faq(db: Annotated[AsyncSession, Depends(get_db)], locale: str = "ru") -> dict[str, object]:
    rows = (await db.execute(
        select(ContentDocument).where(
            ContentDocument.kind == "faq",
            ContentDocument.locale == locale,
            ContentDocument.is_published.is_(True),
        ).order_by(ContentDocument.created_at)
    )).scalars().all()
    return {"success": True, "data": [{"id": str(row.id), "title": row.title, "body": row.body} for row in rows]}


@router.get("/legal")
async def legal_documents(db: Annotated[AsyncSession, Depends(get_db)], locale: str = "ru") -> dict[str, object]:
    rows = (await db.execute(
        select(ContentDocument).where(
            ContentDocument.kind == "legal",
            ContentDocument.locale == locale,
            ContentDocument.is_published.is_(True),
        ).order_by(ContentDocument.created_at)
    )).scalars().all()
    return {"success": True, "data": [{"slug": row.slug, "title": row.title} for row in rows]}


@router.get("/legal/{slug}")
async def legal_document(slug: str, db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    row = await db.scalar(select(ContentDocument).where(
        ContentDocument.kind == "legal",
        ContentDocument.slug == slug,
        ContentDocument.is_published.is_(True),
    ))
    if row is None:
        raise HTTPException(404, "Document not found")
    return {"success": True, "data": {"slug": row.slug, "title": row.title, "body": row.body}}
