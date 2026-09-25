"""Maintenance-mode flag storage backed by Redis with DB audit state."""

from redis import asyncio as aioredis
from redis.exceptions import RedisError

from flytopay.config import get_settings

MAINTENANCE_KEY = "flytopay:maintenance"


def _redis() -> aioredis.Redis:
    return aioredis.from_url(get_settings().redis_url, decode_responses=True)


async def set_maintenance_state(enabled: bool, message: str) -> None:
    client = _redis()
    try:
        if enabled:
            await client.set(MAINTENANCE_KEY, message or "Технические работы")
        else:
            await client.delete(MAINTENANCE_KEY)
    except (RedisError, OSError, ValueError):
        # Availability outranks the control plane flag.
        pass
    finally:
        await client.aclose()


async def get_maintenance_state() -> str | None:
    client = _redis()
    try:
        return await client.get(MAINTENANCE_KEY)
    except (RedisError, OSError, ValueError):
        return None
    finally:
        await client.aclose()
