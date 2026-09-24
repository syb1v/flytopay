"""Read models and guarded user management endpoints for the admin cabinet."""

import hashlib
from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from flytopay.admin.audit import record_admin_action
from flytopay.admin_security import AdminAuditEvent, AdminPrincipal, require_admin_permission
from flytopay.auth.csrf import verify_csrf
from flytopay.auth.session import revoke_user_sessions
from flytopay.cards.models import Rental, UserCard
from flytopay.config import telegram_admin_ids
from flytopay.db.models import Session, TelegramAccount, User
from flytopay.db.session import get_db
from flytopay.ledger.models import Wallet
from flytopay.payments.models import PaymentAttempt

router = APIRouter(prefix="/api/v1/admin", tags=["Admin"])
ReadAdmin = Annotated[AdminPrincipal, Depends(require_admin_permission("admin.read"))]


class ActionReason(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


async def _count(db: AsyncSession, model: type, *conditions: object) -> int:
    return await db.scalar(select(func.count()).select_from(model).where(*conditions)) or 0


@router.get("/dashboard")
async def dashboard(_: ReadAdmin, db: Annotated[AsyncSession, Depends(get_db)]) -> dict:
    now = datetime.now(UTC)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=29)
    totals = {
        "users": await _count(db, User),
        "telegramAccounts": await _count(db, TelegramAccount),
        "activeUsers": await _count(db, User, User.status == "active"),
        "blockedUsers": await _count(db, User, User.status == "blocked"),
        "newToday": await _count(db, User, User.created_at >= now.replace(hour=0, minute=0, second=0, microsecond=0)),
        "newWeek": await _count(db, User, User.created_at >= now - timedelta(days=7)),
        "newMonth": await _count(db, User, User.created_at >= now - timedelta(days=30)),
        "cards": await _count(db, UserCard),
        "demoCards": await _count(db, UserCard, UserCard.is_demo.is_(True)),
        "activeRentals": await _count(db, Rental, Rental.status == "active"),
        "payments": await _count(db, PaymentAttempt),
        "successfulPayments": await _count(db, PaymentAttempt, PaymentAttempt.status == "succeeded"),
        "failedPayments": await _count(db, PaymentAttempt, PaymentAttempt.status == "failed"),
        "wallets": await _count(db, Wallet),
    }
    amounts = await db.execute(select(PaymentAttempt.currency, func.sum(PaymentAttempt.amount_minor))
                               .where(PaymentAttempt.status == "succeeded").group_by(PaymentAttempt.currency))
    balances = await db.execute(select(Wallet.currency, func.sum(Wallet.available_minor)).group_by(Wallet.currency))

    async def series(model: type) -> dict[str, int]:
        rows = await db.execute(select(func.date(model.created_at), func.count())
                                .where(model.created_at >= start).group_by(func.date(model.created_at)))
        return {str(day): count for day, count in rows.all()}

    users_by_day, payments_by_day, rentals_by_day = await series(User), await series(PaymentAttempt), await series(Rental)
    days = [{"date": (start + timedelta(days=i)).date().isoformat(),
             "users": users_by_day.get((start + timedelta(days=i)).date().isoformat(), 0),
             "payments": payments_by_day.get((start + timedelta(days=i)).date().isoformat(), 0),
             "rentals": rentals_by_day.get((start + timedelta(days=i)).date().isoformat(), 0)} for i in range(30)]
    return {"success": True, "data": {"totals": totals, "paymentAmounts": dict(amounts.all()),
                                        "walletBalances": dict(balances.all()), "days": days}}


@router.get("/users/search")
async def search_users(
    _: ReadAdmin, db: Annotated[AsyncSession, Depends(get_db)],
    q: str = Query("", max_length=255), status: Literal["active", "blocked"] | None = None,
    activity: Literal["7d", "30d"] | None = None,
    page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100),
    sort: Literal["createdAt", "telegramId"] = "createdAt", order: Literal["asc", "desc"] = "desc",
) -> dict:
    page = max(page, 1)
    limit = min(max(limit, 1), 100)
    if status not in {None, "active", "blocked"}:
        status = None
    if activity not in {None, "7d", "30d"}:
        activity = None
    if sort not in {"createdAt", "telegramId"}:
        sort = "createdAt"
    if order not in {"asc", "desc"}:
        order = "desc"
    statement = select(User.id, User.status, User.created_at, TelegramAccount.telegram_id,
                       TelegramAccount.username).outerjoin(TelegramAccount, TelegramAccount.user_id == User.id)
    if status:
        statement = statement.where(User.status == status)
    if activity:
        statement = statement.where(User.created_at >= datetime.now(UTC) - timedelta(days=7 if activity == "7d" else 30))
    term = q.strip()
    if term:
        try:
            user_uuid = UUID(term)
        except ValueError:
            user_uuid = None
        if user_uuid:
            statement = statement.where(User.id == user_uuid)
        elif term.lstrip("@").isdigit():
            statement = statement.where(TelegramAccount.telegram_id == int(term.lstrip("@")))
        else:
            statement = statement.where(TelegramAccount.username.ilike(f"%{term.lstrip('@')}%"))
    total = await db.scalar(select(func.count()).select_from(statement.subquery())) or 0
    column = User.created_at if sort == "createdAt" else TelegramAccount.telegram_id
    statement = statement.order_by(column.asc() if order == "asc" else column.desc(), User.id.asc())
    rows = (await db.execute(statement.offset((page - 1) * limit).limit(limit))).all()
    return {"success": True, "data": {"items": [
        {"userId": str(uid), "telegramId": tid, "username": username, "status": state,
         "createdAt": created.isoformat()} for uid, state, created, tid, username in rows
    ], "total": total, "page": page, "limit": limit}}


@router.get("/users/stats")
async def user_stats(_: ReadAdmin, db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, object]:
    now = datetime.now(UTC)
    active = await _count(db, User, User.status == "active")
    blocked = await _count(db, User, User.status == "blocked")
    deleted = await _count(db, User, User.status == "deleted")
    return {"success": True, "data": {"totalUsers": await _count(db, User), "activeUsers": active,
        "blockedUsers": blocked, "deletedUsers": deleted,
        "newToday": await _count(db, User, User.created_at >= now.replace(hour=0, minute=0, second=0, microsecond=0)),
        "newWeek": await _count(db, User, User.created_at >= now - timedelta(days=7)),
        "newMonth": await _count(db, User, User.created_at >= now - timedelta(days=30)),
        "usersWithCards": await _count(db, UserCard), "usersWithRentals": await _count(db, Rental)}}


@router.get("/users/{user_id}")
async def user_detail(user_id: UUID, _: ReadAdmin, db: Annotated[AsyncSession, Depends(get_db)]) -> dict:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(404, "User not found")
    accounts = (await db.execute(select(TelegramAccount.telegram_id, TelegramAccount.username)
                                 .where(TelegramAccount.user_id == user_id))).all()
    cards = (await db.execute(select(UserCard.id, UserCard.status, UserCard.last_four, UserCard.is_demo)
                              .where(UserCard.user_id == user_id).order_by(UserCard.created_at.desc()).limit(50))).all()
    payments = (await db.execute(select(PaymentAttempt.id, PaymentAttempt.status, PaymentAttempt.amount_minor,
                                        PaymentAttempt.currency, PaymentAttempt.created_at)
                                 .where(PaymentAttempt.user_id == user_id).order_by(PaymentAttempt.created_at.desc()).limit(20))).all()
    wallets = (await db.execute(select(Wallet.currency, Wallet.available_minor).where(Wallet.user_id == user_id))).all()
    active_sessions = await _count(db, Session, Session.user_id == user_id, Session.revoked_at.is_(None))
    return {"success": True, "data": {"userId": str(user.id), "status": user.status,
        "createdAt": user.created_at.isoformat(),
        "accounts": [{"telegramId": tid, "username": name} for tid, name in accounts],
        "cards": [{"cardId": str(cid), "status": state, "lastFour": last, "isDemo": demo}
                  for cid, state, last, demo in cards],
        "payments": [{"paymentId": str(pid), "status": state, "amountMinor": amount,
                      "currency": currency, "createdAt": created.isoformat()}
                     for pid, state, amount, currency, created in payments],
        "rentalCount": await _count(db, Rental, Rental.user_id == user_id),
        "activeSessions": active_sessions,
        "wallets": [{"currency": currency, "availableMinor": balance} for currency, balance in wallets]}}


@router.get("/activity")
async def activity(_: ReadAdmin, db: Annotated[AsyncSession, Depends(get_db)],
                   page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100)) -> dict:
    total = await _count(db, AdminAuditEvent)
    events = (await db.execute(select(AdminAuditEvent).order_by(AdminAuditEvent.created_at.desc(),
                 AdminAuditEvent.id.desc()).offset((page - 1) * limit).limit(limit))).scalars().all()
    return {"success": True, "data": {"items": [{"actorUserId": str(event.actor_user_id) if event.actor_user_id else None,
        "action": event.action, "resourceId": event.resource_id, "reason": event.details.get("reason"),
        "createdAt": event.created_at.isoformat()} for event in events], "total": total,
        "page": page, "limit": limit}}


async def _change_user(user_id: UUID, action: str, body: ActionReason, request: Request,
                       principal: AdminPrincipal, db: AsyncSession, key: str | None) -> dict:
    if not key or len(key) > 255:
        raise HTTPException(400, "Idempotency-Key is required")
    reason = body.reason.strip()
    if len(reason) < 3:
        raise HTTPException(422, "Reason is required")
    user = await db.scalar(select(User).where(User.id == user_id).with_for_update())
    if user is None:
        raise HTTPException(404, "User not found")
    key_hash = hashlib.sha256(f"{principal.user_id}:{key}".encode()).hexdigest()
    existing = await db.scalar(select(AdminAuditEvent.id).where(
        AdminAuditEvent.action == action, AdminAuditEvent.resource_id == str(user_id),
        AdminAuditEvent.details["idempotency_hash"].as_string() == key_hash))
    if existing:
        return {"success": True, "data": {"userId": str(user_id), "status": user.status}}
    if action == "user.block":
        admin_ids = telegram_admin_ids()
        owner = await db.scalar(select(TelegramAccount.telegram_id).where(
            TelegramAccount.user_id == user_id, TelegramAccount.telegram_id.in_(admin_ids))) if admin_ids else None
        if owner is not None:
            raise HTTPException(403, "Cannot block bootstrap admin")
        user.status = "blocked"
    elif action in {"user.unblock", "user.restore"}:
        user.status = "active"
    elif action == "user.delete":
        if principal.user_id == user_id:
            raise HTTPException(409, "Cannot delete current administrator")
        user.status = "deleted"
    revoked = await revoke_user_sessions(db, user_id) if action != "user.unblock" else 0
    record_admin_action(db, request, principal.user_id, action, user_id, reason, key_hash, revoked)
    await db.commit()
    return {"success": True, "data": {"userId": str(user_id), "status": user.status,
                                       "revokedSessions": revoked}}


@router.post("/users/{user_id}/block", dependencies=[Depends(verify_csrf)])
async def block_user(user_id: UUID, body: ActionReason, request: Request,
                     principal: Annotated[AdminPrincipal, Depends(require_admin_permission("admin.users.write"))],
                     db: Annotated[AsyncSession, Depends(get_db)],
                     idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict:
    return await _change_user(user_id, "user.block", body, request, principal, db, idempotency_key)


@router.post("/users/{user_id}/unblock", dependencies=[Depends(verify_csrf)])
async def unblock_user(user_id: UUID, body: ActionReason, request: Request,
                       principal: Annotated[AdminPrincipal, Depends(require_admin_permission("admin.users.write"))],
                       db: Annotated[AsyncSession, Depends(get_db)],
                       idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict:
    return await _change_user(user_id, "user.unblock", body, request, principal, db, idempotency_key)


@router.post("/users/{user_id}/revoke-sessions", dependencies=[Depends(verify_csrf)])
async def revoke_sessions(user_id: UUID, body: ActionReason, request: Request,
                          principal: Annotated[AdminPrincipal, Depends(require_admin_permission("admin.sessions.write"))],
                          db: Annotated[AsyncSession, Depends(get_db)],
                          idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict:
    return await _change_user(user_id, "user.revoke_sessions", body, request, principal, db, idempotency_key)


@router.post("/users/{user_id}/restore", dependencies=[Depends(verify_csrf)])
async def restore_user(user_id: UUID, body: ActionReason, request: Request,
                       principal: Annotated[AdminPrincipal, Depends(require_admin_permission("admin.users.write"))],
                       db: Annotated[AsyncSession, Depends(get_db)],
                       idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict:
    return await _change_user(user_id, "user.restore", body, request, principal, db, idempotency_key)


@router.delete("/users/{user_id}", dependencies=[Depends(verify_csrf)])
async def delete_user(user_id: UUID, body: ActionReason, request: Request,
                      principal: Annotated[AdminPrincipal, Depends(require_admin_permission("admin.users.write"))],
                      db: Annotated[AsyncSession, Depends(get_db)],
                      idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> dict:
    return await _change_user(user_id, "user.delete", body, request, principal, db, idempotency_key)
