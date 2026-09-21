from typing import Annotated

from aiogram import Bot
from aiogram.types import Update
from fastapi import APIRouter, Header, HTTPException, Request, status

from flytopay.config import get_settings
from flytopay.telegram.bot import create_bot, create_dispatcher

router = APIRouter(prefix="/api/v1/telegram", tags=["Telegram"])
dispatcher = create_dispatcher()


@router.post("/webhook", status_code=status.HTTP_200_OK)
async def telegram_webhook(request: Request, x_telegram_bot_api_secret_token: Annotated[str | None, Header()] = None) -> dict[str, bool]:
    expected = get_settings().telegram_webhook_secret
    if not expected or x_telegram_bot_api_secret_token != expected:
        raise HTTPException(status_code=401, detail="Invalid Telegram webhook secret")
    bot: Bot = create_bot()
    try:
        update = Update.model_validate(await request.json())
        await dispatcher.feed_update(bot, update)
    finally:
        await bot.session.close()
    return {"ok": True}
