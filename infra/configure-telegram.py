import asyncio
import os

from aiogram import Bot
from aiogram.types import BotCommand, MenuButtonWebApp, WebAppInfo


async def main() -> None:
    bot = Bot(os.environ["TELEGRAM_BOT_TOKEN"])
    try:
        commands = [BotCommand(command="start", description="Открыть Flytopay"), BotCommand(command="app", description="Открыть кабинет")]
        if os.environ.get("TELEGRAM_ADMIN_IDS"):
            commands.append(BotCommand(command="admin", description="Admin panel"))
        await bot.set_my_commands(commands)
        await bot.set_chat_menu_button(menu_button=MenuButtonWebApp(text="Flytopay", web_app=WebAppInfo(url="https://flytopay.net/cabinet")))
        await bot.set_webhook(url="https://flytopay.net/api/v1/telegram/webhook", secret_token=os.environ["TELEGRAM_WEBHOOK_SECRET"], allowed_updates=["message", "callback_query"])
        me = await bot.get_me()
        info = await bot.get_webhook_info()
        print(f"bot=@{me.username} webhook={info.url} pending={info.pending_update_count}")
    finally:
        await bot.session.close()


asyncio.run(main())
