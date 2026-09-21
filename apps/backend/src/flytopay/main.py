"""FastAPI application entrypoint."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from flytopay.api.health import router as health_router
from flytopay.config import get_settings


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
    return app


app = create_app()
