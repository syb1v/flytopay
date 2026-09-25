"""Admin endpoints for user notes and tags."""

import hashlib
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flytopay.admin.audit import record_admin_action
from flytopay.admin_security import AdminPrincipal, require_admin_permission
from flytopay.auth.csrf import verify_csrf
from flytopay.db.models import User
from flytopay.db.session import get_db
from flytopay.user_admin.models import UserNote, UserTag, UserTagAssignment

router = APIRouter(prefix="/api/v1/admin/users", tags=["Admin User Notes"])
WriteUsers = Annotated[AdminPrincipal, Depends(require_admin_permission("admin.users.write"))]
ReadUsers = Annotated[AdminPrincipal, Depends(require_admin_permission("admin.users.read"))]


class NoteInput(BaseModel):
    body: str = Field(min_length=1, max_length=10000)


class TagInput(BaseModel):
    name: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-zА-Яа-я0-9 _.-]+$")
    color: str | None = Field(default=None, max_length=16)


@router.get("/{user_id}/notes")
async def notes(user_id: UUID, _: ReadUsers, db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    rows = (await db.execute(select(UserNote).where(UserNote.user_id == user_id)
                             .order_by(UserNote.created_at.desc()).limit(200))).scalars().all()
    return {"success": True, "data": [{"id": str(row.id), "body": row.body,
        "authorUserId": str(row.author_user_id) if row.author_user_id else None,
        "createdAt": row.created_at.isoformat()} for row in rows]}


@router.post("/{user_id}/notes", dependencies=[Depends(verify_csrf)])
async def add_note(user_id: UUID, body: NoteInput, request: Request, principal: WriteUsers,
                   db: Annotated[AsyncSession, Depends(get_db)],
                   idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
    if not idempotency_key:
        raise HTTPException(400, "Idempotency-Key is required")
    if await db.get(User, user_id) is None:
        raise HTTPException(404, "User not found")
    note = UserNote(user_id=user_id, author_user_id=principal.user_id, body=body.body.strip())
    db.add(note)
    await db.flush()
    key_hash = hashlib.sha256(f"{principal.user_id}:{idempotency_key}".encode()).hexdigest()
    record_admin_action(db, request, principal.user_id, "user.note_add", user_id, body.body.strip()[:200], key_hash)
    await db.commit()
    return {"success": True, "data": {"id": str(note.id)}}


@router.delete("/{user_id}/notes/{note_id}", dependencies=[Depends(verify_csrf)])
async def delete_note(user_id: UUID, note_id: UUID, request: Request, principal: WriteUsers,
                      db: Annotated[AsyncSession, Depends(get_db)],
                      idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
    if not idempotency_key:
        raise HTTPException(400, "Idempotency-Key is required")
    note = await db.scalar(select(UserNote).where(UserNote.id == note_id, UserNote.user_id == user_id))
    if note is None:
        raise HTTPException(404, "Note not found")
    await db.delete(note)
    key_hash = hashlib.sha256(f"{principal.user_id}:{idempotency_key}".encode()).hexdigest()
    record_admin_action(db, request, principal.user_id, "user.note_delete", user_id, "Note deleted", key_hash)
    await db.commit()
    return {"success": True, "data": {"id": str(note_id), "deleted": True}}


@router.get("/tags/catalog")
async def tags_catalog(_: ReadUsers, db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    rows = (await db.execute(select(UserTag).order_by(UserTag.name))).scalars().all()
    return {"success": True, "data": [{"id": str(row.id), "name": row.name, "color": row.color} for row in rows]}


@router.post("/tags/catalog", dependencies=[Depends(verify_csrf)])
async def create_tag(body: TagInput, request: Request, principal: WriteUsers,
                     db: Annotated[AsyncSession, Depends(get_db)],
                     idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
    if not idempotency_key:
        raise HTTPException(400, "Idempotency-Key is required")
    existing = await db.scalar(select(UserTag).where(UserTag.name == body.name.strip()))
    if existing is not None:
        return {"success": True, "data": {"id": str(existing.id), "name": existing.name, "color": existing.color}}
    tag = UserTag(name=body.name.strip(), color=body.color)
    db.add(tag)
    await db.flush()
    key_hash = hashlib.sha256(f"{principal.user_id}:{idempotency_key}".encode()).hexdigest()
    record_admin_action(db, request, principal.user_id, "user.tag_create", tag.id, tag.name, key_hash)
    await db.commit()
    return {"success": True, "data": {"id": str(tag.id), "name": tag.name, "color": tag.color}}


@router.get("/{user_id}/tags")
async def user_tags(user_id: UUID, _: ReadUsers, db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    rows = (await db.execute(select(UserTag).join(UserTagAssignment, UserTagAssignment.tag_id == UserTag.id)
                             .where(UserTagAssignment.user_id == user_id).order_by(UserTag.name))).scalars().all()
    return {"success": True, "data": [{"id": str(row.id), "name": row.name, "color": row.color} for row in rows]}


@router.put("/{user_id}/tags/{tag_id}", dependencies=[Depends(verify_csrf)])
async def assign_tag(user_id: UUID, tag_id: UUID, request: Request, principal: WriteUsers,
                     db: Annotated[AsyncSession, Depends(get_db)],
                     idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
    if not idempotency_key:
        raise HTTPException(400, "Idempotency-Key is required")
    if await db.get(User, user_id) is None or await db.get(UserTag, tag_id) is None:
        raise HTTPException(404, "User or tag not found")
    existing = await db.scalar(select(UserTagAssignment).where(
        UserTagAssignment.user_id == user_id, UserTagAssignment.tag_id == tag_id))
    if existing is None:
        db.add(UserTagAssignment(user_id=user_id, tag_id=tag_id))
    key_hash = hashlib.sha256(f"{principal.user_id}:{idempotency_key}".encode()).hexdigest()
    record_admin_action(db, request, principal.user_id, "user.tag_assign", user_id, str(tag_id), key_hash)
    await db.commit()
    return {"success": True, "data": {"userId": str(user_id), "tagId": str(tag_id), "assigned": True}}


@router.delete("/{user_id}/tags/{tag_id}", dependencies=[Depends(verify_csrf)])
async def remove_tag(user_id: UUID, tag_id: UUID, request: Request, principal: WriteUsers,
                     db: Annotated[AsyncSession, Depends(get_db)],
                     idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict[str, object]:
    if not idempotency_key:
        raise HTTPException(400, "Idempotency-Key is required")
    assignment = await db.scalar(select(UserTagAssignment).where(
        UserTagAssignment.user_id == user_id, UserTagAssignment.tag_id == tag_id))
    if assignment is not None:
        await db.delete(assignment)
    key_hash = hashlib.sha256(f"{principal.user_id}:{idempotency_key}".encode()).hexdigest()
    record_admin_action(db, request, principal.user_id, "user.tag_remove", user_id, str(tag_id), key_hash)
    await db.commit()
    return {"success": True, "data": {"userId": str(user_id), "tagId": str(tag_id), "assigned": False}}
