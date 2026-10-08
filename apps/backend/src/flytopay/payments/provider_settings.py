"""Admin-managed payment provider availability (keys stay in the environment)."""

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flytopay.admin_platform.models import SystemSetting
from flytopay.payments.service import PaymentService

PROVIDER_CATALOG: dict[str, dict[str, str]] = {
    "platega": {
        "title": "Platega",
        "description": "Оплата картой и СБП в рублях через Platega",
    },
    "pay2328": {
        "title": "2328 Pay",
        "description": "Оплата через платёжный шлюз 2328",
    },
    "telegram_stars": {
        "title": "Telegram Stars",
        "description": "Оплата звёздами Telegram внутри Mini App",
    },
}

PROVIDER_KEYS = tuple(PROVIDER_CATALOG)


def _setting_key(provider: str) -> str:
    return f"payment_provider.{provider}"


async def is_provider_enabled(db: AsyncSession, provider: str) -> bool:
    setting = await db.scalar(select(SystemSetting).where(SystemSetting.key == _setting_key(provider)))
    if setting is None:
        return True
    return bool((setting.value or {}).get("enabled", True))


async def provider_status(db: AsyncSession, service: PaymentService | None = None) -> list[dict[str, Any]]:
    service = service or PaymentService()
    items: list[dict[str, Any]] = []
    for key, meta in PROVIDER_CATALOG.items():
        client = service.providers.get(key)
        configured = bool(getattr(client, "is_configured", False))
        enabled = await is_provider_enabled(db, key)
        items.append({
            "key": key,
            "title": meta["title"],
            "description": meta["description"],
            "configured": configured,
            "enabled": enabled,
            "active": configured and enabled,
        })
    return items
