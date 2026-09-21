from typing import Any

import httpx
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flytopay.cards.models import CardProduct
from flytopay.integrations.caas2328.client import CaaSClient

logger = structlog.get_logger(__name__)


async def sync_provider_catalog(db: AsyncSession) -> None:
    client = CaaSClient()
    if not client.is_configured:
        return
    try:
        remote_items = await client.products()
        for item in remote_items:
            code = str(item.get("code", "")).strip()
            if not code:
                continue
            result = await db.execute(select(CardProduct).where(CardProduct.code == code))
            product = result.scalar_one_or_none()
            if product is None:
                product = CardProduct(code=code, provider_code=code, name=code, scheme="unknown", currency="USD")
            product.name = str(item.get("name") or product.name)
            product.scheme = str(item.get("scheme") or product.scheme).lower()
            product.currency = str(item.get("currency") or product.currency).upper()
            product.max_cards_per_cardholder = item.get("maxCardsPerCardholder")
            settings: Any = item.get("providerSettings")
            product.provider_settings = settings if isinstance(settings, list) else None
            product.enabled = True
            db.add(product)
        await db.commit()
    except (httpx.HTTPError, RuntimeError, ValueError) as exc:
        await db.rollback()
        logger.warning("CaaS catalog sync unavailable", error=type(exc).__name__)
