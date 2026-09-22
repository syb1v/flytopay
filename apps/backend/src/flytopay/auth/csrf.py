"""CSRF protection for cookie-authenticated state-changing requests.

Strategy: signed double-submit cookie. A `flytopay_csrf` cookie holds a random
token; mutating endpoints require the same token in the `X-CSRF-Token` header.
Additionally, browser requests are checked against the configured web origin.
"""

import hmac
import secrets
from typing import Annotated

from fastapi import Cookie, Header, HTTPException, Request, status

from flytopay.config import get_settings

CSRF_COOKIE = "flytopay_csrf"
CSRF_HEADER = "X-CSRF-Token"
SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


def issue_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def _origin_allowed(request: Request) -> bool:
    settings = get_settings()
    if not settings.web_origin:
        return True
    origin = request.headers.get("origin")
    if not origin:
        return True  # Non-browser clients (mobile app, curl) send no Origin.
    return origin.rstrip("/") == settings.web_origin.rstrip("/")


async def verify_csrf(
    request: Request,
    x_csrf_token: Annotated[str | None, Header(alias="X-CSRF-Token")] = None,
    flytopay_csrf: Annotated[str | None, Cookie(alias=CSRF_COOKIE)] = None,
) -> None:
    if request.method in SAFE_METHODS:
        return
    if request.headers.get("authorization"):
        return  # Header-authenticated calls are not cookie-based CSRF targets.
    if not _origin_allowed(request):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cross-origin request rejected")
    if not flytopay_csrf or not x_csrf_token or not hmac.compare_digest(flytopay_csrf, x_csrf_token):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF token missing or invalid")
