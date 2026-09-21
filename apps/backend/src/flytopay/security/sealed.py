import base64
import json
from typing import Any

from cryptography.fernet import Fernet, InvalidToken

from flytopay.config import get_settings


def _fernet() -> Fernet:
    raw = get_settings().encryption_master_key
    if not raw:
        raise RuntimeError("ENCRYPTION_MASTER_KEY is not configured")
    try:
        key = raw.encode() if len(raw) == 44 else base64.urlsafe_b64encode(raw.encode().ljust(32, b"0")[:32])
        return Fernet(key)
    except (ValueError, TypeError) as exc:
        raise RuntimeError("Invalid ENCRYPTION_MASTER_KEY") from exc


def seal_json(value: dict[str, Any]) -> str:
    return _fernet().encrypt(json.dumps(value, separators=(",", ":")).encode()).decode()


def open_json(value: str) -> dict[str, Any]:
    try:
        return json.loads(_fernet().decrypt(value.encode()).decode())
    except (InvalidToken, ValueError, TypeError, json.JSONDecodeError) as exc:
        raise RuntimeError("Unable to decrypt protected payload") from exc
