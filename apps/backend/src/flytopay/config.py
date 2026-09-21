"""Environment-backed application settings."""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = Field(default="development", validation_alias="APP_ENV")
    app_name: str = Field(default="flytopay", validation_alias="APP_NAME")
    log_level: str = Field(default="INFO", validation_alias="LOG_LEVEL")
    session_secret: str = Field(default="development-only-session-secret", validation_alias="SESSION_SECRET")
    csrf_secret: str = Field(default="development-only-csrf-secret", validation_alias="CSRF_SECRET")
    database_url: str = Field(default="postgresql+asyncpg://flytopay:flytopay@localhost:5432/flytopay", validation_alias="DATABASE_URL")
    redis_url: str = Field(default="redis://localhost:6379/0", validation_alias="REDIS_URL")
    web_origin: str = Field(default="http://localhost:3000", validation_alias="WEB_ORIGIN")
    api_origin: str = Field(default="http://localhost:8000", validation_alias="API_ORIGIN")
    telegram_bot_token: str | None = Field(default=None, validation_alias="TELEGRAM_BOT_TOKEN")
    telegram_webhook_secret: str | None = Field(default=None, validation_alias="TELEGRAM_WEBHOOK_SECRET")
    platega_merchant_id: str | None = Field(default=None, validation_alias="PLATEGA_MERCHANT_ID")
    platega_secret: str | None = Field(default=None, validation_alias="PLATEGA_SECRET")
    platega_base_url: str = Field(default="https://app.platega.io", validation_alias="PLATEGA_BASE_URL")
    pay2328_api_key: str | None = Field(default=None, validation_alias="PAY2328_API_KEY")
    pay2328_base_url: str = Field(default="https://api.2328.io/api", validation_alias="PAY2328_BASE_URL")
    pay2328_project_uuid: str | None = Field(default=None, validation_alias="PAY2328_PROJECT_UUID")
    caas_api_key: str | None = Field(default=None, validation_alias="CAAS_API_KEY")
    caas_base_url: str = Field(default="https://api.2328.io/caas/v1", validation_alias="CAAS_BASE_URL")
    caas_webhook_secret: str | None = Field(default=None, validation_alias="CAAS_WEBHOOK_SECRET")
    encryption_master_key: str | None = Field(default=None, validation_alias="ENCRYPTION_MASTER_KEY")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
