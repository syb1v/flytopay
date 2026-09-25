"""Broadcast audience resolution and delivery execution."""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flytopay.content.models import Broadcast, BroadcastDelivery
from flytopay.db.models import TelegramAccount, User

SEGMENTS = frozenset({"all", "active", "blocked"})


def normalize_audience(audience: dict | None) -> dict:
    segment = (audience or {}).get("segment", "all")
    if segment not in SEGMENTS:
        segment = "all"
    return {"segment": segment}


async def audience_telegram_ids(db: AsyncSession, audience: dict | None) -> list[int]:
    segment = normalize_audience(audience)["segment"]
    statement = select(TelegramAccount.telegram_id).join(User, User.id == TelegramAccount.user_id)
    if segment != "all":
        statement = statement.where(User.status == segment)
    return list((await db.scalars(statement.order_by(TelegramAccount.telegram_id))).all())


async def queue_broadcast_for_users(db: AsyncSession, broadcast: Broadcast) -> int:
    segment = normalize_audience(broadcast.audience)["segment"]
    statement = select(TelegramAccount.telegram_id, TelegramAccount.user_id).join(User, User.id == TelegramAccount.user_id)
    if segment != "all":
        statement = statement.where(User.status == segment)
    rows = (await db.execute(statement.order_by(TelegramAccount.telegram_id))).all()
    for telegram_id, user_id in rows:
        db.add(BroadcastDelivery(broadcast_id=broadcast.id, user_id=user_id, status="pending"))
    return len(rows)


async def send_broadcast(db: AsyncSession, broadcast_id) -> dict[str, int]:
    """Send all pending deliveries of a broadcast through Telegram."""
    from flytopay.telegram.bot import create_bot

    broadcast = await db.get(Broadcast, broadcast_id)
    if broadcast is None:
        raise ValueError("Broadcast not found")
    if broadcast.status not in {"queued", "sending", "scheduled"}:
        raise ValueError("Broadcast is not sendable")
    deliveries = (await db.execute(
        select(BroadcastDelivery).where(BroadcastDelivery.broadcast_id == broadcast_id,
                                        BroadcastDelivery.status == "pending")
    )).scalars().all()
    sent = 0
    failed = 0
    if deliveries:
        bot = create_bot()
        try:
            for delivery in deliveries:
                telegram_id = await db.scalar(
                    select(TelegramAccount.telegram_id).where(TelegramAccount.user_id == delivery.user_id)
                )
                if telegram_id is None:
                    delivery.status = "failed"
                    delivery.error = "Telegram account is missing"
                    failed += 1
                    continue
                try:
                    await bot.send_message(chat_id=telegram_id, text=broadcast.body)
                    delivery.status = "sent"
                    sent += 1
                except Exception as exc:  # noqa: BLE001 - per-recipient provider errors
                    delivery.status = "failed"
                    delivery.error = type(exc).__name__
                    failed += 1
        finally:
            await bot.session.close()
    broadcast.sent_count = sent
    broadcast.failed_count = failed
    broadcast.status = "sent" if failed == 0 else "sent_with_errors"
    await db.commit()
    return {"sent": sent, "failed": failed}


def mark_sending(broadcast: Broadcast) -> None:
    broadcast.status = "sending"
    broadcast.scheduled_at = None


def now_utc() -> datetime:
    return datetime.now(UTC)
