"""Keep ownership of injected HTTP clients with their caller."""

from contextlib import asynccontextmanager

import httpx


@asynccontextmanager
async def payment_http(client: httpx.AsyncClient | None):
    if client is not None:
        yield client
    else:
        async with httpx.AsyncClient(timeout=30, follow_redirects=False) as owned:
            yield owned
