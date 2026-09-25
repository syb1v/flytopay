from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from flytopay.config import get_settings

engine = create_async_engine(get_settings().database_url, pool_pre_ping=True)
session_factory = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncIterator[AsyncSession]:
    async with session_factory() as session:
        yield session


@asynccontextmanager
async def task_session() -> AsyncIterator[AsyncSession]:
    """Per-task session with a disposable NullPool engine.

    Celery tasks run each call under a fresh event loop; asyncpg connections are
    bound to the loop that created them, so a shared pooled engine leaks one
    connection per task run until Postgres refuses new clients. A NullPool engine
    disposed after the task keeps connection usage flat.
    """
    task_engine = create_async_engine(get_settings().database_url, poolclass=NullPool)
    factory = async_sessionmaker(task_engine, expire_on_commit=False)
    try:
        async with factory() as session:
            yield session
    finally:
        await task_engine.dispose()
