"""Bootstrap owner resolution from the deployment environment."""

from flytopay.config import telegram_admin_ids


def is_bootstrap_owner(telegram_id: int | None) -> bool:
    """Return whether a Telegram ID is an environment-configured owner."""

    return telegram_id is not None and telegram_id in telegram_admin_ids()
