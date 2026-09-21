import hashlib
import hmac
from urllib.parse import urlencode

import pytest

from flytopay.auth.telegram import TelegramInitDataError, validate_init_data


def signed_data(bot_token: str, auth_date: int) -> str:
    values = {"auth_date": str(auth_date), "query_id": "query-1", "user": '{"id":42}'}
    check = "\n".join(f"{key}={value}" for key, value in sorted(values.items()))
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    values["hash"] = hmac.new(secret_key, check.encode(), hashlib.sha256).hexdigest()
    return urlencode(values)


def test_valid_telegram_init_data_is_accepted() -> None:
    result = validate_init_data(signed_data("token", 1_000), "token", now=1_100)
    assert result["query_id"] == "query-1"


def test_expired_telegram_init_data_is_rejected() -> None:
    with pytest.raises(TelegramInitDataError, match="expired"):
        validate_init_data(signed_data("token", 1), "token", now=2_000)
