"""
MongoDB backend — thin wrapper around Motor that creates performance indexes
on startup so every query hits an index rather than doing a collection scan.
"""
from __future__ import annotations

import os
from typing import Any, Callable, Tuple

from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING


class MongoDatabaseProxy:
    """Wraps a Motor database and delegates all attribute access to it."""

    def __init__(self, motor_db: Any) -> None:
        self._db = motor_db

    # Forward everything (collections, methods) to the underlying Motor db.
    def __getattr__(self, name: str) -> Any:
        return getattr(self._db, name)

    @classmethod
    async def create(cls) -> Tuple["MongoDatabaseProxy", Callable]:
        mongo_url = os.environ["MONGO_URL"]
        kwargs: dict = {}
        if os.getenv("MONGO_TLS_ALLOW_INVALID_CERTIFICATES", "false").strip().lower() in {
            "1", "true", "yes", "on"
        }:
            kwargs["tlsAllowInvalidCertificates"] = True

        client = AsyncIOMotorClient(mongo_url, **kwargs)
        motor_db = client[os.environ["DB_NAME"]]
        proxy = cls(motor_db)

        await _ensure_indexes(motor_db)

        async def close() -> None:
            client.close()

        return proxy, close


async def _ensure_indexes(db: Any) -> None:
    """Create all compound indexes in the background — idempotent."""

    # ── users ──────────────────────────────────────────────────────────────
    await db.users.create_index("email", unique=True, background=True)

    # ── accounts ───────────────────────────────────────────────────────────
    await db.accounts.create_index([("user_id", ASCENDING)], background=True)
    await db.accounts.create_index(
        [("user_id", ASCENDING), ("code", ASCENDING)], background=True
    )
    await db.accounts.create_index(
        [("user_id", ASCENDING), ("type", ASCENDING)], background=True
    )

    # ── transactions ───────────────────────────────────────────────────────
    await db.transactions.create_index(
        [("user_id", ASCENDING), ("date", DESCENDING)], background=True
    )
    await db.transactions.create_index(
        [("user_id", ASCENDING), ("account_id", ASCENDING)], background=True
    )
    await db.transactions.create_index(
        [("user_id", ASCENDING), ("source", ASCENDING)], background=True
    )
    await db.transactions.create_index(
        [("user_id", ASCENDING), ("month", ASCENDING)], background=True
    )

    # ── invoices ───────────────────────────────────────────────────────────
    await db.invoices.create_index(
        [("user_id", ASCENDING), ("issue_date", DESCENDING)], background=True
    )
    await db.invoices.create_index(
        [("user_id", ASCENDING), ("status", ASCENDING)], background=True
    )

    # ── receipts ───────────────────────────────────────────────────────────
    await db.receipts.create_index(
        [("user_id", ASCENDING), ("issue_date", DESCENDING)], background=True
    )

    # ── integrations ───────────────────────────────────────────────────────
    await db.integrations.create_index(
        [("user_id", ASCENDING), ("provider", ASCENDING)],
        unique=True,
        background=True,
    )

    # ── sessions ───────────────────────────────────────────────────────────
    await db.user_sessions.create_index(
        "session_token", unique=True, background=True
    )
    await db.user_sessions.create_index(
        [("user_id", ASCENDING)], background=True
    )

    # ── auth state ─────────────────────────────────────────────────────────
    await db.google_auth_state.create_index(
        "state", unique=True, background=True
    )
