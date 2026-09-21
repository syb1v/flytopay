"""Webhook-driven Telegram bot runtime."""

from aiogram import Bot, Dispatcher, Router
from aiogram.filters import Command, CommandStart
from aiogram.types import (
    BotCommand,
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    MenuButtonWebApp,
    Message,
    WebAppInfo,
    WebhookInfo,
)

from flytopay.config import get_settings
from flytopay.telegram.admin import admin_keyboard, is_admin

router = Router(name="flytopay")


def mini_app_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="Открыть Flytopay", web_app=WebAppInfo(url="https://flytopay.net/cabinet"))]])


@router.message(CommandStart())
async def start_handler(message: Message) -> None:
    await message.answer("Добро пожаловать в Flytopay. Управляйте виртуальными картами и платежами в одном кабинете.", reply_markup=mini_app_keyboard())


@router.message(Command("app"))
async def app_handler(message: Message) -> None:
    await message.answer("Откройте личный кабинет Flytopay:", reply_markup=mini_app_keyboard())


@router.message(Command("admin"))
async def admin_handler(message: Message) -> None:
    if not is_admin(message.from_user.id if message.from_user else None):
        return
    await message.answer("Админ-панель Flytopay", reply_markup=admin_keyboard())


@router.callback_query(lambda query: query.data in {"admin:users", "admin:demo_cards"})
async def admin_callback(query: CallbackQuery) -> None:
    if not is_admin(query.from_user.id):
        await query.answer("Доступ запрещён", show_alert=True)
        return
    if query.data == "admin:users":
        await query.message.answer("Пользователи доступны в dashboard; Telegram allowlist активен.")
    else:
        await query.message.answer("Demo-карты: используйте /admin_seed_demo после проверки env.")
    await query.answer()


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
        commands = [BotCommand(command="start", description="Открыть Flytopay"), BotCommand(command="app", description="Открыть кабинет")]
        if get_settings().telegram_admin_ids:
            commands.append(BotCommand(command="admin", description="Admin panel"))
        await bot.set_my_commands(commands)
        await bot.set_chat_menu_button(menu_button=MenuButtonWebApp(text="Flytopay", web_app=WebAppInfo(url="https://flytopay.net/cabinet")))
        return await bot.get_webhook_info()
    finally:
        await bot.session.close()
