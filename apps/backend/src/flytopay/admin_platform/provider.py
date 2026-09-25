"""Live 2328 provider checks: liveness, account, wallet balance, pricing, movements."""

import time
from typing import Annotated

from fastapi import APIRouter, Depends

from flytopay.admin_security import AdminPrincipal, require_admin_permission
from flytopay.integrations.caas2328.client import CaaSClient, CaaSError

router = APIRouter(prefix="/api/v1/admin/system/provider", tags=["Admin Provider"])
ReadProvider = Annotated[AdminPrincipal, Depends(require_admin_permission("admin.system.read"))]


@router.get("")
async def provider_status(_: ReadProvider) -> dict[str, object]:
    """Real provider probe; secrets never leave the backend."""
    client = CaaSClient()
    result: dict[str, object] = {"configured": client.is_configured, "baseUrl": client.base_url}
    if not client.is_configured:
        result["status"] = "not_configured"
        return {"success": True, "data": result}

    started = time.perf_counter()
    try:
        ping = await client.ping()
        result["ping"] = {"ok": True, "latencyMs": round((time.perf_counter() - started) * 1000), "api": ping.get("api")}
        result["status"] = "ok"
    except (CaaSError, RuntimeError) as exc:
        result["ping"] = {"ok": False, "latencyMs": round((time.perf_counter() - started) * 1000), "error": str(exc)}
        result["status"] = "unreachable"

    try:
        info = await client.account_info()
        result["account"] = {
            "accountId": info.get("accountId"),
            "status": info.get("status"),
            "environment": info.get("environment"),
            "currencies": (info.get("limits") or {}).get("walletCurrencies") or info.get("walletCurrencies"),
            "features": info.get("features"),
        }
    except (CaaSError, RuntimeError) as exc:
        result["accountError"] = str(exc)

    try:
        wallet = await client.account_wallet()
        result["wallet"] = wallet
    except (CaaSError, RuntimeError) as exc:
        result["walletError"] = str(exc)

    try:
        pricing = await client.account_pricing()
        result["pricing"] = pricing
    except (CaaSError, RuntimeError) as exc:
        result["pricingError"] = str(exc)

    try:
        movements = await client.account_transactions(limit=20)
        items = movements.get("items") if isinstance(movements, dict) else None
        result["transactions"] = items if isinstance(items, list) else []
    except (CaaSError, RuntimeError) as exc:
        result["transactionsError"] = str(exc)

    return {"success": True, "data": result}
