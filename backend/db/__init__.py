"""
Database factory for Ledgerly.

Set DB_BACKEND in .env to choose the backend:
  DB_BACKEND=mongo     — MongoDB via Motor (default)
  DB_BACKEND=postgres  — PostgreSQL via asyncpg

The module exposes a `db` lazy-proxy that is transparent to all callers;
the real connection is wired in during FastAPI lifespan startup.
"""
from __future__ import annotations

import os
from typing import Any, Callable, Optional

_db_instance: Optional[Any] = None
_close_fn: Optional[Callable] = None


# ─────────────────────────────────────────────────────────────
# Lazy proxy — forwards every attribute lookup to the live db
# after startup_db() has been called.
# ─────────────────────────────────────────────────────────────

class _LazyDb:
    __slots__ = ()

    def __getattr__(self, name: str) -> Any:
        if _db_instance is None:
            raise RuntimeError(
                "Database not initialised. "
                "Make sure startup_db() is awaited inside the FastAPI lifespan."
            )
        return getattr(_db_instance, name)


db: Any = _LazyDb()


# ─────────────────────────────────────────────────────────────
# Startup / shutdown hooks — called from server.py lifespan
# ─────────────────────────────────────────────────────────────

async def startup_db() -> None:
    global _db_instance, _close_fn

    backend = os.getenv("DB_BACKEND", "mongo").strip().lower()

    if backend == "postgres":
        from .postgres_db import PostgresDatabaseProxy, create_postgres_schema
        try:
            proxy, close = await PostgresDatabaseProxy.create()
        except RuntimeError as exc:
            raise RuntimeError(
                f"[DB_BACKEND=postgres] {exc}\n\n"
                "Make sure POSTGRES_URL is set to a publicly accessible PostgreSQL "
                "connection string in your deployment secrets."
            ) from exc
        await create_postgres_schema(proxy)
        _db_instance = proxy
        _close_fn = close
    else:
        from .mongo_db import MongoDatabaseProxy
        try:
            proxy, close = await MongoDatabaseProxy.create()
        except Exception as exc:
            raise RuntimeError(
                f"[DB_BACKEND=mongo] Failed to connect to MongoDB: {exc}\n\n"
                "Make sure MONGO_URL is set in your deployment secrets."
            ) from exc
        _db_instance = proxy
        _close_fn = close


async def shutdown_db() -> None:
    if _close_fn is not None:
        await _close_fn()
