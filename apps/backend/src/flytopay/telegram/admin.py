from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from flytopay.cards.models import Rental, UserCard
from flytopay.config import telegram_admin_ids
from flytopay.db.models import TelegramAccount, User


def is_admin(telegram_id: int | None) -> bool:
    return telegram_id is not None and telegram_id in telegram_admin_ids()


def admin_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="Пользователи", callback_data="admin:users")],
        [InlineKeyboardButton(text="Demo-карты", callback_data="admin:demo_cards")],
        [InlineKeyboardButton(text="Статус сервиса", callback_data="admin:status")],
    ])


async def overview(db: AsyncSession) -> str:
    users = await db.scalar(select(func.count()).select_from(User)) or 0
    telegram_users = await db.scalar(select(func.count()).select_from(TelegramAccount)) or 0
    cards = await db.scalar(select(func.count()).select_from(UserCard)) or 0
    demo_cards = await db.scalar(select(func.count()).select_from(UserCard).where(UserCard.is_demo.is_(True))) or 0
    rentals = await db.scalar(select(func.count()).select_from(Rental)) or 0
    return ("<b>Flytopay overview</b>\n\n"
            f"Пользователи: <b>{users}</b>\nTelegram accounts: <b>{telegram_users}</b>\n"
            f"Карты: <b>{cards}</b>\nDemo-карты: <b>{demo_cards}</b>\nАренды: <b>{rentals}</b>")


async def demo_cards_report(db: AsyncSession) -> str:
    result = await db.execute(select(TelegramAccount.telegram_id, UserCard.status, UserCard.last_four).join(UserCard, UserCard.user_id == TelegramAccount.user_id).where(UserCard.is_demo.is_(True)).order_by(TelegramAccount.telegram_id))
    rows = result.all()
    if not rows:
        return "<b>Demo-карты</b>\n\nНет demo-карт."
    lines = ["<b>Demo-карты</b>", ""]
    lines.extend(f"{telegram_id}: •••• {last_four or '—'} · {status}" for telegram_id, status, last_four in rows)
    return "\n".join(lines)
