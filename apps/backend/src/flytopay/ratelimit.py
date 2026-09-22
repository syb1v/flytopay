"""Redis-backed sliding-window rate limiting for abuse-sensitive endpoints."""

from datetime import UTC, datetime

from redis import asyncio as aioredis
from redis.exceptions import RedisError

from flytopay.config import get_settings

_WINDOW_SECONDS = 60


def _redis() -> aioredis.Redis:
    settings = get_settings()
    return aioredis.from_url(settings.redis_url, decode_responses=True)


def _now_ms() -> int:
    return int(datetime.now(UTC).timestamp() * 1000)


async def rate_limit(scope: str, identity: str, *, limit: int, window_seconds: int = _WINDOW_SECONDS) -> bool:
    """Return True when the request is allowed; False when the limit is exceeded."""
    client = _redis()
    try:
        key = f"ratelimit:{scope}:{identity}"
        now = _now_ms()
        window_start = now - window_seconds * 1000
        pipe = client.pipeline()
        pipe.zremrangebyscore(key, 0, window_start)
        pipe.zcard(key)
        pipe.zadd(key, {f"{now}": now})
        pipe.expire(key, window_seconds + 1)
        results = await pipe.execute()
        count = int(results[1])
        return count < limit
    except (RedisError, OSError, ValueError):
        # Fail open: availability outranks strict limiting on Redis outages.
        return True
    finally:
        await client.aclose()
