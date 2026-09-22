"""Fail-fast production environment validation.

Import has no side effects; call `validate_runtime_environment()` from the
ASGI entrypoint (and any CLI entrypoint) before serving traffic.
"""

import sys

from flytopay.config import get_settings

_INSECURE_SECRETS = frozenset(
    {
        "development-only-session-secret",
        "development-only-csrf-secret",
        "replace-with-a-long-random-value",
    }
)


def _issues(settings) -> list[str]:
    problems: list[str] = []
    if settings.app_env != "production":
        return problems
    if settings.session_secret in _INSECURE_SECRETS or len(settings.session_secret) < 32:
        problems.append("SESSION_SECRET must be a strong random value (>=32 chars) in production")
    if settings.csrf_secret in _INSECURE_SECRETS or len(settings.csrf_secret) < 32:
        problems.append("CSRF_SECRET must be a strong random value (>=32 chars) in production")
    if not settings.caas_api_key:
        problems.append("CAAS_API_KEY is required in production")
    if not settings.encryption_master_key or len(settings.encryption_master_key) < 32:
        problems.append("ENCRYPTION_MASTER_KEY must be set (>=32 chars) in production")
    if settings.database_url == "postgresql+asyncpg://flytopay:flytopay@localhost:5432/flytopay":
        problems.append("DATABASE_URL must not use development defaults in production")
    return problems


def validate_runtime_environment() -> None:
    problems = _issues(get_settings())
    if problems:
        for problem in problems:
            print(f"[startup] FATAL: {problem}", file=sys.stderr)
        raise SystemExit(1)
