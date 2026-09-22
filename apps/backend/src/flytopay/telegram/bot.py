"""Webhook-driven Telegram bot runtime."""

from aiogram import Bot, Dispatcher, F, Router
from aiogram.filters import Command, CommandStart
from aiogram.types import (
    BotCommand,
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    MenuButtonWebApp,
    Message,
    PreCheckoutQuery,
    SuccessfulPayment,
    WebAppInfo,
    WebhookInfo,
)
from structlog import get_logger

from flytopay.config import get_settings
from flytopay.db.session import session_factory
from flytopay.telegram.admin import admin_keyboard, demo_cards_report, is_admin, overview

router = Router(name="flytopay")
logger = get_logger(__name__)


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


@router.callback_query(lambda query: query.data in {"admin:users", "admin:demo_cards", "admin:status"})
async def admin_callback(query: CallbackQuery) -> None:
    if not is_admin(query.from_user.id):
        await query.answer("Доступ запрещён", show_alert=True)
        return
    async with session_factory() as db:
        text = await overview(db) if query.data in {"admin:users", "admin:status"} else await demo_cards_report(db)
    await query.message.answer(text, parse_mode="HTML")
    await query.answer("Готово")


@router.pre_checkout_query()
async def pre_checkout_handler(query: PreCheckoutQuery, bot: Bot) -> None:
    # The wallet credit happens on successful_payment; accept all pending invoices.
    await bot.answer_pre_checkout_query(query.id, ok=True)


@router.message(F.successful_payment)
async def successful_payment_handler(message: Message) -> None:
    from sqlalchemy import select

    from flytopay.db.models import TelegramAccount
    from flytopay.ledger.service import LedgerError, credit_wallet
    from flytopay.payments.models import PaymentAttempt

    payment: SuccessfulPayment | None = message.successful_payment
    if payment is None or message.from_user is None:
        return
    async with session_factory() as db:
        account = (
            await db.execute(select(TelegramAccount).where(TelegramAccount.telegram_id == message.from_user.id))
        ).scalar_one_or_none()
        attempt = (
            await db.execute(
                select(PaymentAttempt).where(
                    PaymentAttempt.provider == "telegram_stars",
                    PaymentAttempt.correlation_id == payment.invoice_payload,
                )
            )
        ).scalar_one_or_none()
        if account is None or attempt is None:
            logger.warning("stars_payment_unmatched", payload=payment.invoice_payload)
            return
        if attempt.user_id != account.user_id:
            logger.warning("stars_payment_user_mismatch", payload=payment.invoice_payload)
            return
        if attempt.status == "finalized":
            return
        attempt.provider_payment_id = payment.telegram_payment_charge_id
        attempt.status = "finalized"
        try:
            await credit_wallet(
                db,
                attempt.user_id,
                attempt.amount_minor,
                external_key=f"stars:{payment.telegram_payment_charge_id}",
                kind="payment",
            )
        except LedgerError:
            await db.rollback()
            logger.warning("stars_payment_duplicate_credit", payload=payment.invoice_payload)
            return
        await db.commit()
        logger.info("stars_payment_credited", user=str(attempt.user_id), amount_minor=attempt.amount_minor)
        try:
            await message.answer(
                f"Баланс пополнен на {attempt.amount_minor / 10**attempt.scale:.2f} {attempt.currency}.",
            )
        except Exception:
            logger.exception("stars_payment_confirmation_message_failed", user_id=message.from_user.id)


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
