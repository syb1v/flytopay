"""Fee policy math and payment provider availability guards."""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from flytopay.cards.lifecycle_routes import fund_charge_minor, unload_credit_minor
from flytopay.payments.provider_settings import PROVIDER_CATALOG, is_provider_enabled, provider_status


def test_fund_charge_includes_provider_and_service_fee():
    service_fee, total = fund_charge_minor(1000, 35, 500)
    assert service_fee == 50
    assert total == 1085


def test_fund_charge_without_fees_matches_amount():
    assert fund_charge_minor(1000, 0, 0) == (0, 1000)


def test_unload_credit_nets_service_fee():
    service_fee, credit = unload_credit_minor(1000, 100)
    assert service_fee == 10
    assert credit == 990


def test_unload_credit_without_fee_is_unchanged():
    assert unload_credit_minor(2000, 0) == (0, 2000)


@pytest.mark.asyncio
async def test_provider_enabled_by_default_without_setting():
    db = SimpleNamespace(scalar=AsyncMock(return_value=None))
    assert await is_provider_enabled(db, "platega") is True


@pytest.mark.asyncio
async def test_provider_status_reports_configured_and_enabled():
    db = SimpleNamespace(scalar=AsyncMock(return_value=None))
    service = SimpleNamespace(providers={
        "platega": SimpleNamespace(is_configured=True),
        "pay2328": SimpleNamespace(is_configured=False),
        "telegram_stars": SimpleNamespace(is_configured=True),
    })
    items = {item["key"]: item for item in await provider_status(db, service)}
    assert set(items) == set(PROVIDER_CATALOG)
    assert items["platega"]["active"] is True
    assert items["pay2328"]["active"] is False
    assert items["telegram_stars"]["configured"] is True
