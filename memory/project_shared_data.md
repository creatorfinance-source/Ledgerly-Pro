---
name: project-shared-data
description: Transactions with source=seed-next are visible to ALL authenticated users (shared org data)
metadata:
  type: project
---

Transactions tagged `source: "seed-next"` represent the NEXT Ventures Jan–May 2026 P&L data imported by an admin. Every authenticated user can see this data regardless of which user_id seeded it.

Implemented via `$or: [{user_id: <current>}, {source: "seed-next"}]` in:
- `_user_data()` — feeds all statement endpoints + dashboard
- `list_transactions` GET endpoint
- `list_journal_entries` GET endpoint
- `cost_centers_used` GET endpoint

Accounts are loaded for all user_ids appearing in the fetched transactions to ensure statement lookups resolve correctly.

**Why:** Company financial data should be visible org-wide, not locked to the seeder's account.

**How to apply:** Any new data endpoints that list transactions should apply the same `$or` pattern.
