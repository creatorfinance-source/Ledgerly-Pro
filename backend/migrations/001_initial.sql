-- Ledgerly PostgreSQL Schema — optimised for fast queries
-- Idempotent: safe to re-run (all CREATE statements use IF NOT EXISTS).
--
-- NOTE: All timestamp columns use TEXT/VARCHAR so the app can store
-- ISO-8601 strings (matching MongoDB behaviour) without asyncpg type errors.

-- ─────────────────────────────────────────────────────────────
-- USERS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    user_id         VARCHAR(32)  PRIMARY KEY,
    email           VARCHAR(255) UNIQUE NOT NULL,
    name            VARCHAR(255) NOT NULL DEFAULT '',
    picture         TEXT                 DEFAULT '',
    provider        VARCHAR(50)          DEFAULT 'email',
    password_hash   VARCHAR(255),
    default_currency VARCHAR(10)         DEFAULT 'USD',
    organization    VARCHAR(255)         DEFAULT 'My Company',
    created_at      VARCHAR(60)          DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ─────────────────────────────────────────────────────────────
-- ACCOUNTS  (Chart of Accounts)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accounts (
    account_id  VARCHAR(32) PRIMARY KEY,
    user_id     VARCHAR(32) NOT NULL,
    name        VARCHAR(255) NOT NULL,
    code        VARCHAR(50)  NOT NULL DEFAULT '',
    type        VARCHAR(50)  NOT NULL,
    currency    VARCHAR(10)           DEFAULT 'USD',
    description TEXT                  DEFAULT '',
    is_default  BOOLEAN               DEFAULT FALSE,
    created_at  VARCHAR(60)           DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_accounts_user         ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user_code    ON accounts(user_id, code);
CREATE INDEX IF NOT EXISTS idx_accounts_user_type    ON accounts(user_id, type);

-- ─────────────────────────────────────────────────────────────
-- TRANSACTIONS  (high-volume — most indexes here)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
    txn_id            VARCHAR(32)    PRIMARY KEY,
    user_id           VARCHAR(32)    NOT NULL,
    date              VARCHAR(20)    NOT NULL DEFAULT '',
    description       TEXT                   DEFAULT '',
    amount            DECIMAL(20,4)  NOT NULL DEFAULT 0,
    currency          VARCHAR(10)            DEFAULT 'USD',
    type              VARCHAR(10)    NOT NULL,
    account_id        VARCHAR(32)            DEFAULT '',
    contra_account_id VARCHAR(32),
    category          VARCHAR(255)           DEFAULT '',
    month             VARCHAR(20)            DEFAULT '',
    department        VARCHAR(255)           DEFAULT '',
    subcategory       VARCHAR(255)           DEFAULT '',
    ledger            VARCHAR(255)           DEFAULT '',
    vendor            VARCHAR(255)           DEFAULT '',
    tx_id             VARCHAR(255)           DEFAULT '',
    source            VARCHAR(50)            DEFAULT 'manual',
    external_ref      VARCHAR(255),
    reconciled        BOOLEAN                DEFAULT FALSE,
    created_at        VARCHAR(60)            DEFAULT ''
);

-- Compound indexes tuned to the exact query patterns in list_transactions
CREATE INDEX IF NOT EXISTS idx_txn_user_date    ON transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_txn_user_account ON transactions(user_id, account_id);
CREATE INDEX IF NOT EXISTS idx_txn_user_source  ON transactions(user_id, source);
CREATE INDEX IF NOT EXISTS idx_txn_user_month   ON transactions(user_id, month);
-- Partial index: unreconciled transactions (common operational filter)
CREATE INDEX IF NOT EXISTS idx_txn_unreconciled
    ON transactions(user_id, date DESC) WHERE reconciled = FALSE;

-- ─────────────────────────────────────────────────────────────
-- INVOICES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
    invoice_id      VARCHAR(32)   PRIMARY KEY,
    user_id         VARCHAR(32)   NOT NULL,
    number          VARCHAR(50)            DEFAULT '',
    customer_name   VARCHAR(255)           DEFAULT '',
    customer_email  VARCHAR(255)           DEFAULT '',
    issue_date      VARCHAR(20)            DEFAULT '',
    due_date        VARCHAR(20)            DEFAULT '',
    line_items      JSONB                  DEFAULT '[]',
    subtotal        DECIMAL(20,4)          DEFAULT 0,
    tax_rate        DECIMAL(10,4)          DEFAULT 0,
    tax_amount      DECIMAL(20,4)          DEFAULT 0,
    total           DECIMAL(20,4)          DEFAULT 0,
    currency        VARCHAR(10)            DEFAULT 'USD',
    notes           TEXT                   DEFAULT '',
    status          VARCHAR(50)            DEFAULT 'draft',
    created_at      VARCHAR(60)            DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_invoices_user        ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_date   ON invoices(user_id, issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_user_status ON invoices(user_id, status);

-- ─────────────────────────────────────────────────────────────
-- RECEIPTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS receipts (
    receipt_id  VARCHAR(32)   PRIMARY KEY,
    user_id     VARCHAR(32)   NOT NULL,
    number      VARCHAR(50)            DEFAULT '',
    payer_name  VARCHAR(255)           DEFAULT '',
    issue_date  VARCHAR(20)            DEFAULT '',
    line_items  JSONB                  DEFAULT '[]',
    subtotal    DECIMAL(20,4)          DEFAULT 0,
    tax_rate    DECIMAL(10,4)          DEFAULT 0,
    tax_amount  DECIMAL(20,4)          DEFAULT 0,
    total       DECIMAL(20,4)          DEFAULT 0,
    currency    VARCHAR(10)            DEFAULT 'USD',
    method      VARCHAR(50)            DEFAULT 'cash',
    notes       TEXT                   DEFAULT '',
    created_at  VARCHAR(60)            DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_receipts_user      ON receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_receipts_user_date ON receipts(user_id, issue_date DESC);

-- ─────────────────────────────────────────────────────────────
-- INTEGRATIONS  (PSPs + Google Sheets)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS integrations (
    integration_id VARCHAR(32)  PRIMARY KEY,
    user_id        VARCHAR(32)  NOT NULL,
    provider       VARCHAR(100) NOT NULL,
    status         VARCHAR(50)           DEFAULT 'disconnected',
    last_sync      VARCHAR(60),
    config         JSONB                 DEFAULT '{}',
    created_at     VARCHAR(60)           DEFAULT '',
    UNIQUE(user_id, provider)
);
CREATE INDEX IF NOT EXISTS idx_integrations_user          ON integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_integrations_user_provider ON integrations(user_id, provider);

-- ─────────────────────────────────────────────────────────────
-- GOOGLE SHEETS TOKENS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS google_sheets_tokens (
    user_id       VARCHAR(32) PRIMARY KEY,
    access_token  TEXT,
    refresh_token TEXT,
    expiry        VARCHAR(60),
    scopes        JSONB       DEFAULT '[]',
    email         VARCHAR(255),
    updated_at    VARCHAR(60)           DEFAULT ''
);

-- ─────────────────────────────────────────────────────────────
-- GOOGLE AUTH STATE  (login OAuth PKCE state)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS google_auth_state (
    state         VARCHAR(512) PRIMARY KEY,
    code_verifier TEXT,
    created_at    VARCHAR(60)  DEFAULT ''
);

-- ─────────────────────────────────────────────────────────────
-- GOOGLE OAUTH STATE  (sheets OAuth PKCE state, keyed by user_id)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS google_oauth_state (
    user_id       VARCHAR(32)  PRIMARY KEY,
    state         VARCHAR(512),
    code_verifier TEXT,
    created_at    VARCHAR(60)  DEFAULT ''
);

-- ─────────────────────────────────────────────────────────────
-- USER SESSIONS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_sessions (
    id             SERIAL       PRIMARY KEY,
    user_id        VARCHAR(32)  NOT NULL,
    session_token  VARCHAR(512) UNIQUE NOT NULL,
    expires_at     VARCHAR(60),
    created_at     VARCHAR(60)  DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_sessions_token   ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);

-- (TIMESTAMPTZ → VARCHAR patch is handled in Python inside create_postgres_schema)
