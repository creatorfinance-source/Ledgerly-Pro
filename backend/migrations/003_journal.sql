-- 003_journal.sql
-- Group transaction postings into balanced journal entries.
-- Idempotent: safe to re-run.

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS journal_id VARCHAR(64) DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_txn_user_journal ON transactions(user_id, journal_id);
