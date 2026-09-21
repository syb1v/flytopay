"""Telegram Mini App initData verification."""

import hashlib
import hmac
import time
from urllib.parse import parse_qsl


class TelegramInitDataError(ValueError):
    pass


def validate_init_data(init_data: str, bot_token: str, *, max_age_seconds: int = 900, now: int | None = None) -> dict[str, str]:
    if not init_data or not bot_token:
        raise TelegramInitDataError("Telegram init data is missing")
    values = dict(parse_qsl(init_data, keep_blank_values=True))
    received_hash = values.pop("hash", None)
    if not received_hash:
        raise TelegramInitDataError("Telegram init data hash is missing")
    auth_date = values.get("auth_date")
    if not auth_date or not auth_date.isdigit():
        raise TelegramInitDataError("Telegram auth date is invalid")
    current = int(time.time()) if now is None else now
    if current - int(auth_date) > max_age_seconds or int(auth_date) > current + 60:
        raise TelegramInitDataError("Telegram init data is expired")
    data_check_string = "\n".join(f"{key}={value}" for key, value in sorted(values.items()))
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    expected_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected_hash, received_hash):
        raise TelegramInitDataError("Telegram init data signature is invalid")
    return values
