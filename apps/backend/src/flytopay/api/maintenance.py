"""Fail-open maintenance mode middleware."""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from flytopay.admin_platform.maintenance import get_maintenance_state

ALLOWED_PREFIXES = (
    "/health",
    "/api/v1/health",
    "/api/v1/admin",
    "/api/v1/auth",
    "/api/v1/telegram/webhook",
    "/api/v1/webhooks",
    "/docs",
    "/openapi.json",
    "/redoc",
)


class MaintenanceModeMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if any(path.startswith(prefix) for prefix in ALLOWED_PREFIXES):
            return await call_next(request)
        message = await get_maintenance_state()
        if message:
            return JSONResponse(
                status_code=503,
                content={"success": False, "detail": message, "maintenance": True},
            )
        return await call_next(request)
