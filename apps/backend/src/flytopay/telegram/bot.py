"""Webhook-driven Telegram bot runtime."""

from aiogram import Bot, Dispatcher, Router
from aiogram.filters import Command, CommandStart
from aiogram.types import (
    BotCommand,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    MenuButtonWebApp,
    Message,
    WebAppInfo,
    WebhookInfo,
)

from flytopay.config import get_settings

router = Router(name="flytopay")


def mini_app_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="Открыть Flytopay", web_app=WebAppInfo(url="https://flytopay.net/cabinet"))]])


@router.message(CommandStart())
async def start_handler(message: Message) -> None:
    await message.answer("Добро пожаловать в Flytopay. Управляйте виртуальными картами и платежами в одном кабинете.", reply_markup=mini_app_keyboard())


@router.message(Command("app"))
async def app_handler(message: Message) -> None:
    await message.answer("Откройте личный кабинет Flytopay:", reply_markup=mini_app_keyboard())


def create_dispatcher() -> Dispatcher:
    dispatcher = Dispatcher()
    dispatcher.include_router(router)
    return dispatcher


def create_bot() -> Bot:
    token = get_settings().telegram_bot_token
    if not token:
        raise RuntimeError("TELEGRAM_BOT_TOKEN is not configured")
    return Bot(token=token)


async def configure_bot() -> WebhookInfo:
    bot = create_bot()
    try:
        await bot.set_my_commands([BotCommand(command="start", description="Открыть Flytopay"), BotCommand(command="app", description="Открыть кабинет")])
        await bot.set_chat_menu_button(menu_button=MenuButtonWebApp(text="Flytopay", web_app=WebAppInfo(url="https://flytopay.net/cabinet")))
        return await bot.get_webhook_info()
    finally:
        await bot.session.close()
