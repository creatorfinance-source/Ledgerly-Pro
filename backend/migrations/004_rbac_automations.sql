-- RBAC: add role + permissions columns to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'viewer';
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_assigned_by VARCHAR(32) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_updated_at VARCHAR(60) DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Automations
CREATE TABLE IF NOT EXISTS automations (
    automation_id   VARCHAR(32)  PRIMARY KEY,
    user_id         VARCHAR(32)  NOT NULL,
    name            VARCHAR(255) NOT NULL,
    description     TEXT         DEFAULT '',
    trigger_type    VARCHAR(50)  NOT NULL,
    trigger_config  JSONB        NOT NULL DEFAULT '{}',
    action_type     VARCHAR(50)  NOT NULL,
    action_config   JSONB        NOT NULL DEFAULT '{}',
    is_active       BOOLEAN      NOT NULL DEFAULT true,
    last_run_at     VARCHAR(60)  DEFAULT '',
    run_count       INTEGER      NOT NULL DEFAULT 0,
    created_at      VARCHAR(60)  NOT NULL DEFAULT '',
    updated_at      VARCHAR(60)  NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_automations_user ON automations(user_id);
CREATE INDEX IF NOT EXISTS idx_automations_active ON automations(user_id, is_active);
