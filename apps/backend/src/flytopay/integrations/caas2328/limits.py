"""Account-level 2328 limits (min issue/fund/unload, max fund) cached for 10 minutes."""

import time
from dataclasses import dataclass

from flytopay.integrations.caas2328.client import CaaSClient, CaaSError

_TTL = 600.0
_cache: dict[str, object] = {}


@dataclass(frozen=True)
class CaaSLimits:
    min_issue_minor: int = 500
    min_fund_minor: int = 100
    min_unload_minor: int = 100
    max_fund_minor: int = 750_000
    max_operation_minor: int = 100_000_000


async def get_limits(caas: CaaSClient | None = None) -> CaaSLimits:
    cached = _cache.get("limits")
    if isinstance(cached, tuple) and time.monotonic() - cached[0] < _TTL:
        return cached[1]
    caas = caas or CaaSClient()
    limits = CaaSLimits()
    if caas.is_configured:
        try:
            info = await caas.account_info()
            raw = (info.get("capabilities") or {}).get("limits") or {}
            limits = CaaSLimits(
                min_issue_minor=int(raw.get("minIssueAmountMinor") or limits.min_issue_minor),
                min_fund_minor=int(raw.get("minFundMinor") or limits.min_fund_minor),
                min_unload_minor=int(raw.get("minUnloadMinor") or limits.min_unload_minor),
                max_fund_minor=int(raw.get("maxFundMinor") or limits.max_fund_minor),
                max_operation_minor=int(raw.get("maxOperationMinor") or limits.max_operation_minor),
            )
        except (CaaSError, RuntimeError, OSError, ValueError, TypeError):
            return limits
    _cache["limits"] = (time.monotonic(), limits)
    return limits
