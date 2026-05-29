-- 002_prop_firm.sql
-- Prop / CFD firm accounting extensions for NEXT Ventures Ltd.
-- Idempotent: safe to re-run.

-- ─────────────────────────────────────────────────────────────
-- ACCOUNTS: management-category, ledger sub-grouping and cost centre
-- ─────────────────────────────────────────────────────────────
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS category    VARCHAR(255) DEFAULT '';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS subcategory VARCHAR(255) DEFAULT '';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS cost_center VARCHAR(20)  DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_accounts_user_category    ON accounts(user_id, category);
CREATE INDEX IF NOT EXISTS idx_accounts_user_costcenter  ON accounts(user_id, cost_center);

-- ─────────────────────────────────────────────────────────────
-- COST CENTERS  (CC01–CC11 / CORP)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cost_centers (
    cc_code           VARCHAR(20)  NOT NULL,
    user_id           VARCHAR(32)  NOT NULL,
    name              VARCHAR(255) NOT NULL DEFAULT '',
    type              VARCHAR(20)           DEFAULT 'Support',
    allocation_method VARCHAR(255)          DEFAULT '',
    created_at        VARCHAR(60)           DEFAULT '',
    PRIMARY KEY (user_id, cc_code)
);
CREATE INDEX IF NOT EXISTS idx_cost_centers_user ON cost_centers(user_id);
