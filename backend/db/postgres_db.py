"""
PostgreSQL backend — implements a Motor-compatible async collection API
using asyncpg, so server.py and auth.py need zero query-level changes.

API surface implemented:
  collection.find(filter, projection)           → _PgCursor
  collection.find_one(filter, projection)       → dict | None
  collection.insert_one(doc)                    → _Result
  collection.insert_many(docs)                  → _Result
  collection.update_one(filter, update, upsert) → _Result
  collection.delete_one(filter)                 → _Result
  collection.count_documents(filter)            → int

  cursor.sort(key, direction)  → cursor
  cursor.limit(n)              → cursor
  cursor.to_list(length)       → list[dict]
"""
from __future__ import annotations

import json
import os
from decimal import Decimal
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

import asyncpg

# ─────────────────────────────────────────────────────────────────────────────
# Per-table primary-key mapping — used to generate ON CONFLICT clauses for
# upsert operations so we never need to know the table structure at call time.
# ─────────────────────────────────────────────────────────────────────────────
_TABLE_PK: Dict[str, Any] = {
    "users":                "user_id",
    "accounts":             "account_id",
    "transactions":         "txn_id",
    "invoices":             "invoice_id",
    "receipts":             "receipt_id",
    "integrations":         ("user_id", "provider"),   # compound unique
    "cost_centers":         ("user_id", "cc_code"),     # compound unique
    "google_sheets_tokens": "user_id",
    "google_auth_state":    "state",
    "google_oauth_state":   "user_id",
    "user_sessions":        "session_token",
}


# ─────────────────────────────────────────────────────────────────────────────
# asyncpg connection initialiser — register JSON/JSONB codecs so that
# Python dicts/lists are transparently serialised to/from JSONB columns.
# ─────────────────────────────────────────────────────────────────────────────

async def _init_conn(conn: asyncpg.Connection) -> None:
    for codec in ("json", "jsonb"):
        await conn.set_type_codec(
            codec,
            encoder=json.dumps,
            decoder=json.loads,
            schema="pg_catalog",
        )


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _row_to_dict(row: asyncpg.Record) -> dict:
    result = {}
    for k, v in dict(row).items():
        result[k] = float(v) if isinstance(v, Decimal) else v
    return result


def _apply_projection(doc: dict, projection: Optional[dict]) -> dict:
    """Handle MongoDB-style {field: 0} exclusion projections."""
    if not projection:
        return doc
    excluded = {k for k, v in projection.items() if v == 0 and k != "_id"}
    if not excluded:
        return doc
    return {k: v for k, v in doc.items() if k not in excluded}


def _clean_doc(doc: dict) -> dict:
    """Strip the MongoDB-internal _id field before any SQL operation."""
    return {k: v for k, v in doc.items() if k != "_id"}


# ─────────────────────────────────────────────────────────────────────────────
# Cursor — chainable, mirrors Motor's AsyncIOMotorCursor subset
# ─────────────────────────────────────────────────────────────────────────────

class _PgCursor:
    __slots__ = (
        "_pool", "_table", "_where", "_params",
        "_projection", "_sort_col", "_sort_dir", "_limit_val",
    )

    def __init__(
        self,
        pool: asyncpg.Pool,
        table: str,
        where: str,
        params: list,
        projection: Optional[dict] = None,
    ) -> None:
        self._pool = pool
        self._table = table
        self._where = where
        self._params = params
        self._projection = projection
        self._sort_col: Optional[str] = None
        self._sort_dir = "ASC"
        self._limit_val: Optional[int] = None

    def sort(self, key: str, direction: int) -> "_PgCursor":
        self._sort_col = key
        self._sort_dir = "ASC" if direction >= 0 else "DESC"
        return self

    def limit(self, n: int) -> "_PgCursor":
        self._limit_val = n
        return self

    async def to_list(self, length: Optional[int] = None) -> List[dict]:
        limit = length if length is not None else self._limit_val
        sql = f"SELECT * FROM {self._table}"
        if self._where:
            sql += f" WHERE {self._where}"
        if self._sort_col:
            sql += f" ORDER BY {self._sort_col} {self._sort_dir} NULLS LAST"
        if limit:
            sql += f" LIMIT {limit}"
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(sql, *self._params)
        return [
            _apply_projection(_row_to_dict(r), self._projection) for r in rows
        ]


# ─────────────────────────────────────────────────────────────────────────────
# Minimal result stubs (server.py discards these, but they prevent AttributeError)
# ─────────────────────────────────────────────────────────────────────────────

class _Result:
    inserted_id = None
    modified_count = 1
    deleted_count = 1
    acknowledged = True


# ─────────────────────────────────────────────────────────────────────────────
# Collection — Motor-compatible async interface over a single PostgreSQL table
# ─────────────────────────────────────────────────────────────────────────────

class _PgCollection:

    def __init__(self, pool: asyncpg.Pool, table: str) -> None:
        self._pool = pool
        self._table = table

    # ── internal filter builder ──────────────────────────────────────────

    def _where(self, filt: Optional[dict]) -> Tuple[str, list]:
        """Convert a MongoDB-style filter dict to a SQL WHERE clause + params."""
        clauses: List[str] = []
        params: list = []
        idx = 1
        for col, val in (filt or {}).items():
            if isinstance(val, dict):
                _OP = {"$gte": ">=", "$lte": "<=", "$gt": ">", "$lt": "<", "$ne": "!="}
                for op, op_val in val.items():
                    pg_op = _OP.get(op)
                    if pg_op:
                        clauses.append(f"{col} {pg_op} ${idx}")
                        params.append(op_val)
                        idx += 1
                    elif op == "$in" and isinstance(op_val, list):
                        holders = ", ".join(f"${i}" for i in range(idx, idx + len(op_val)))
                        clauses.append(f"{col} IN ({holders})")
                        params.extend(op_val)
                        idx += len(op_val)
            else:
                clauses.append(f"{col} = ${idx}")
                params.append(val)
                idx += 1
        return " AND ".join(clauses), params

    # ── public Motor-compatible API ──────────────────────────────────────

    def find(
        self, filt: Optional[dict] = None, projection: Optional[dict] = None
    ) -> _PgCursor:
        where, params = self._where(filt)
        return _PgCursor(self._pool, self._table, where, params, projection)

    async def find_one(
        self, filt: Optional[dict] = None, projection: Optional[dict] = None
    ) -> Optional[dict]:
        where, params = self._where(filt)
        sql = f"SELECT * FROM {self._table}"
        if where:
            sql += f" WHERE {where}"
        sql += " LIMIT 1"
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(sql, *params)
        if row is None:
            return None
        return _apply_projection(_row_to_dict(row), projection)

    async def insert_one(self, doc: dict) -> _Result:
        doc = _clean_doc(doc)
        cols = list(doc.keys())
        holders = [f"${i + 1}" for i in range(len(cols))]
        sql = (
            f"INSERT INTO {self._table} ({', '.join(cols)}) "
            f"VALUES ({', '.join(holders)}) "
            f"ON CONFLICT DO NOTHING"
        )
        async with self._pool.acquire() as conn:
            await conn.execute(sql, *[doc[c] for c in cols])
        return _Result()

    async def insert_many(self, docs: list) -> _Result:
        if not docs:
            return _Result()
        prepared = [_clean_doc(d) for d in docs]
        cols = list(prepared[0].keys())
        holders = [f"${i + 1}" for i in range(len(cols))]
        sql = (
            f"INSERT INTO {self._table} ({', '.join(cols)}) "
            f"VALUES ({', '.join(holders)}) "
            f"ON CONFLICT DO NOTHING"
        )
        rows = [[d.get(c) for c in cols] for d in prepared]
        async with self._pool.acquire() as conn:
            await conn.executemany(sql, rows)
        return _Result()

    async def update_one(
        self,
        filt: Optional[dict] = None,
        update: Optional[dict] = None,
        upsert: bool = False,
    ) -> _Result:
        set_data = _clean_doc((update or {}).get("$set", {}))

        if upsert:
            # Build a single INSERT … ON CONFLICT … DO UPDATE SET so the
            # operation is atomic and works correctly with concurrent requests.
            merged = _clean_doc({**(filt or {}), **set_data})
            cols = list(merged.keys())
            holders = [f"${i + 1}" for i in range(len(cols))]
            pk = _TABLE_PK.get(self._table)
            if isinstance(pk, tuple):
                conflict_target = ", ".join(pk)
                pk_set = set(pk)
            elif pk:
                conflict_target = pk
                pk_set = {pk}
            else:
                conflict_target = cols[0]
                pk_set = {cols[0]}

            update_cols = [c for c in cols if c not in pk_set]
            if update_cols:
                do_clause = "DO UPDATE SET " + ", ".join(
                    f"{c} = EXCLUDED.{c}" for c in update_cols
                )
            else:
                do_clause = "DO NOTHING"

            sql = (
                f"INSERT INTO {self._table} ({', '.join(cols)}) "
                f"VALUES ({', '.join(holders)}) "
                f"ON CONFLICT ({conflict_target}) {do_clause}"
            )
            async with self._pool.acquire() as conn:
                await conn.execute(sql, *[merged[c] for c in cols])
            return _Result()

        if not set_data:
            return _Result()

        set_clauses: List[str] = []
        params: list = []
        idx = 1
        for col, val in set_data.items():
            set_clauses.append(f"{col} = ${idx}")
            params.append(val)
            idx += 1

        where_clauses: List[str] = []
        for col, val in (filt or {}).items():
            where_clauses.append(f"{col} = ${idx}")
            params.append(val)
            idx += 1

        sql = f"UPDATE {self._table} SET {', '.join(set_clauses)}"
        if where_clauses:
            sql += f" WHERE {' AND '.join(where_clauses)}"

        async with self._pool.acquire() as conn:
            await conn.execute(sql, *params)
        return _Result()

    async def delete_one(self, filt: Optional[dict] = None) -> _Result:
        # All delete calls in the app filter by primary key, so at most one
        # row matches — a plain DELETE without LIMIT is safe.
        where, params = self._where(filt)
        sql = f"DELETE FROM {self._table}"
        if where:
            sql += f" WHERE {where}"
        async with self._pool.acquire() as conn:
            await conn.execute(sql, *params)
        return _Result()

    async def delete_many(self, filt: Optional[dict] = None) -> _Result:
        where, params = self._where(filt)
        sql = f"DELETE FROM {self._table}"
        if where:
            sql += f" WHERE {where}"
        async with self._pool.acquire() as conn:
            await conn.execute(sql, *params)
        return _Result()

    async def count_documents(self, filt: Optional[dict] = None) -> int:
        where, params = self._where(filt)
        sql = f"SELECT COUNT(*) FROM {self._table}"
        if where:
            sql += f" WHERE {where}"
        async with self._pool.acquire() as conn:
            result = await conn.fetchval(sql, *params)
        return int(result or 0)


# ─────────────────────────────────────────────────────────────────────────────
# Database proxy — attribute access returns a _PgCollection for that table name
# ─────────────────────────────────────────────────────────────────────────────

class PostgresDatabaseProxy:

    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool
        self._cols: Dict[str, _PgCollection] = {}

    def __getattr__(self, name: str) -> _PgCollection:
        if name.startswith("_"):
            raise AttributeError(name)
        if name not in self._cols:
            self._cols[name] = _PgCollection(self._pool, name)
        return self._cols[name]

    @classmethod
    async def create(cls) -> Tuple["PostgresDatabaseProxy", Callable]:
        dsn = os.environ["POSTGRES_URL"]
        pool = await asyncpg.create_pool(
            dsn,
            init=_init_conn,
            min_size=int(os.getenv("PG_POOL_MIN", "3")),
            max_size=int(os.getenv("PG_POOL_MAX", "20")),
            command_timeout=30,
        )

        async def close() -> None:
            await pool.close()

        return cls(pool), close


# ─────────────────────────────────────────────────────────────────────────────
# Schema bootstrap — reads and executes 001_initial.sql on the connected pool
# ─────────────────────────────────────────────────────────────────────────────

async def create_postgres_schema(proxy: PostgresDatabaseProxy) -> None:
    """Run the DDL migration and patch any legacy TIMESTAMPTZ columns.

    Executes each statement individually (asyncpg requirement for multi-
    statement scripts) and handles the TIMESTAMPTZ → VARCHAR(60) conversion
    in Python to avoid dollar-quoted block parsing issues.
    """
    migrations_dir = Path(__file__).parent.parent / "migrations"
    if not migrations_dir.exists():
        return

    # Apply every *.sql migration in filename order (001_, 002_, …). Each file
    # is idempotent (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS), so re-running is safe.
    sql_files = sorted(migrations_dir.glob("*.sql"))
    parts = []
    for sql_path in sql_files:
        lines = [l for l in sql_path.read_text().splitlines()
                 if l.strip() and not l.strip().startswith("--")]
        parts.extend(s.strip() for s in "\n".join(lines).split(";") if s.strip())

    async with proxy._pool.acquire() as conn:
        # 1. Run the regular CREATE TABLE / CREATE INDEX / ALTER statements
        for stmt in parts:
            await conn.execute(stmt)

        # 2. Patch any TIMESTAMPTZ columns created by earlier runs so that
        #    ISO-string inserts from the app don't trigger type-encoding errors.
        rows = await conn.fetch(
            """
            SELECT table_name, column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND column_name IN ('created_at', 'updated_at')
              AND data_type = 'timestamp with time zone'
            """
        )
        for row in rows:
            await conn.execute(
                f"ALTER TABLE {row['table_name']} "
                f"ALTER COLUMN {row['column_name']} TYPE VARCHAR(60) "
                f"USING {row['column_name']}::text"
            )
