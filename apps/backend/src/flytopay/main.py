"""FastAPI application entrypoint."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from flytopay.api.health import router as health_router
from flytopay.auth.routes import router as auth_router
from flytopay.config import get_settings
from flytopay.payments.routes import router as payments_router
from flytopay.payments.webhooks import router as webhooks_router
from flytopay.preferences.routes import router as preferences_router
from flytopay.wallet.routes import router as wallet_router


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Flytopay API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.web_origin],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "Idempotency-Key", "X-Request-ID"],
    )
    app.include_router(health_router)
    app.include_router(health_router, prefix="/api/v1")
    app.include_router(preferences_router)
    app.include_router(auth_router)
    app.include_router(payments_router)
    app.include_router(webhooks_router)
    app.include_router(wallet_router)
    return app


app = create_app()
