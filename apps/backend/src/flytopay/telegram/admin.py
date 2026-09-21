from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup

from flytopay.config import telegram_admin_ids


def is_admin(telegram_id: int | None) -> bool:
    return telegram_id is not None and telegram_id in telegram_admin_ids()


def admin_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="Пользователи", callback_data="admin:users")],
        [InlineKeyboardButton(text="Demo-карты", callback_data="admin:demo_cards")],
    ])
