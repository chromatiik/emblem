-- Emblem database schema (Postgres / Neon)
-- Every statement is safe to re-run (CREATE ... IF NOT EXISTS / idempotent
-- ALTERs), so this file also serves as the upgrade path for existing
-- databases — see db/migrate.ts.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- users
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username        VARCHAR(32) UNIQUE NOT NULL,
  username_lower  VARCHAR(32) UNIQUE NOT NULL,
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  role            VARCHAR(20) NOT NULL DEFAULT 'user', -- user | admin | owner
  is_disabled     BOOLEAN NOT NULL DEFAULT FALSE,
  is_banned       BOOLEAN NOT NULL DEFAULT FALSE,
  discord_id      VARCHAR(32) DEFAULT '',
  discord_username VARCHAR(64) DEFAULT '',
  roblox_user_id  VARCHAR(32) DEFAULT '',
  roblox_username VARCHAR(64) DEFAULT '',
  totp_secret     TEXT,                                -- set once 2FA enrollment begins
  totp_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  failed_logins   INTEGER NOT NULL DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  last_ip         TEXT DEFAULT '',                     -- raw IP, unlike ip_hash elsewhere — needed for admin visibility and ban enforcement
  last_ip_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_last_ip ON users(last_ip);

-- ============================================================================
-- sessions — web dashboard/admin login sessions (NOT loader sessions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  user_agent  TEXT DEFAULT '',
  ip_hash     TEXT DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- ============================================================================
-- pricing_plans
-- ============================================================================
CREATE TABLE IF NOT EXISTS pricing_plans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(60) NOT NULL,
  description       VARCHAR(300) DEFAULT '',
  price_cents       INTEGER NOT NULL,
  currency          VARCHAR(3) NOT NULL DEFAULT 'usd',
  duration_days     INTEGER,                            -- null = lifetime
  stripe_price_id   TEXT DEFAULT '',
  features          TEXT[] DEFAULT '{}',
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- keys — license keys
-- ============================================================================
CREATE TABLE IF NOT EXISTS keys (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash              TEXT NOT NULL UNIQUE,            -- sha256(plaintext key) — plaintext is shown once, never stored
  key_preview           VARCHAR(48) NOT NULL,             -- e.g. "EMBLEM-••••-••••-••••-93QZ" for display
  key_encrypted         TEXT NOT NULL DEFAULT '',          -- AES-256-GCM ciphertext, decryptable server-side for admin/owner lookup — see lib/crypto.ts
  user_id               UUID REFERENCES users(id) ON DELETE SET NULL,
  plan_id               UUID REFERENCES pricing_plans(id),
  status                VARCHAR(12) NOT NULL DEFAULT 'active', -- active | revoked | banned | expired
  hwid_hash             TEXT,
  hwid_bound_at         TIMESTAMPTZ,
  hwid_reset_count      INTEGER NOT NULL DEFAULT 0,
  hwid_last_reset_at    TIMESTAMPTZ,
  usage_count           INTEGER NOT NULL DEFAULT 0,
  last_used_at          TIMESTAMPTZ,
  last_roblox_user_id   VARCHAR(32) DEFAULT '',
  last_roblox_username  VARCHAR(64) DEFAULT '',
  version_compat        VARCHAR(20) DEFAULT 'any',
  admin_notes           TEXT DEFAULT '',
  expires_at            TIMESTAMPTZ,                      -- null = never
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at            TIMESTAMPTZ,
  banned_at             TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_keys_user ON keys(user_id);
CREATE INDEX IF NOT EXISTS idx_keys_status ON keys(status);
CREATE INDEX IF NOT EXISTS idx_keys_hash ON keys(key_hash);

-- ============================================================================
-- key_sessions — short-lived loader authentication sessions
-- ============================================================================
CREATE TABLE IF NOT EXISTS key_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id        UUID NOT NULL REFERENCES keys(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL UNIQUE,
  nonce         TEXT NOT NULL,
  hwid_hash     TEXT,
  ip_hash       TEXT DEFAULT '',
  status        VARCHAR(12) NOT NULL DEFAULT 'issued',    -- issued | consumed | expired
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL,
  consumed_at   TIMESTAMPTZ
);
-- A given nonce can only ever be used once per key — this is the core
-- replay-protection mechanism for the loader auth handshake.
CREATE UNIQUE INDEX IF NOT EXISTS idx_key_sessions_nonce ON key_sessions(key_id, nonce);
CREATE INDEX IF NOT EXISTS idx_key_sessions_expires ON key_sessions(expires_at);

-- ============================================================================
-- hwid_resets — audit trail of every HWID reset (user- or admin-initiated)
-- ============================================================================
CREATE TABLE IF NOT EXISTS hwid_resets (
  id                BIGSERIAL PRIMARY KEY,
  key_id            UUID NOT NULL REFERENCES keys(id) ON DELETE CASCADE,
  old_hwid_hash     TEXT,
  reset_by          VARCHAR(10) NOT NULL,                 -- user | admin
  reset_by_user_id  UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hwid_resets_key ON hwid_resets(key_id);

-- ============================================================================
-- purchases
-- ============================================================================
CREATE TABLE IF NOT EXISTS purchases (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id                       UUID REFERENCES pricing_plans(id),
  key_id                        UUID REFERENCES keys(id),
  payment_provider              VARCHAR(20) NOT NULL DEFAULT 'stripe', -- stripe | nowpayments | paypal_manual
  stripe_checkout_session_id    TEXT UNIQUE,
  stripe_payment_intent_id      TEXT DEFAULT '',
  crypto_payment_id             TEXT DEFAULT '',
  crypto_pay_address            TEXT DEFAULT '',
  crypto_pay_amount             TEXT DEFAULT '',
  crypto_pay_currency           VARCHAR(10) DEFAULT '',
  amount_cents                  INTEGER NOT NULL,
  currency                      VARCHAR(3) NOT NULL DEFAULT 'usd',
  status                        VARCHAR(16) NOT NULL DEFAULT 'pending', -- pending|paid|failed|refunded|disputed|cancelled
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at                       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_crypto_payment ON purchases(crypto_payment_id) WHERE crypto_payment_id != '';

-- ============================================================================
-- payment_events — raw webhook log, drives idempotent processing
-- ============================================================================
CREATE TABLE IF NOT EXISTS payment_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id   TEXT UNIQUE NOT NULL,
  type              VARCHAR(60) NOT NULL,
  payload           JSONB NOT NULL,
  processed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- script_versions — the actual protected payload, server-side only
-- ============================================================================
CREATE TABLE IF NOT EXISTS script_versions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version               VARCHAR(30) NOT NULL,
  release_notes         TEXT DEFAULT '',
  payload               TEXT NOT NULL,                    -- private; never rendered into any HTML response
  is_enabled            BOOLEAN NOT NULL DEFAULT FALSE,    -- only one row should be enabled at a time (enforced in app code)
  supported_executors   TEXT[] DEFAULT '{}',
  created_by            UUID REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_script_versions_enabled ON script_versions(is_enabled);

-- ============================================================================
-- script_usage — every loader auth attempt and payload fetch
-- ============================================================================
CREATE TABLE IF NOT EXISTS script_usage (
  id                  BIGSERIAL PRIMARY KEY,
  key_id              UUID REFERENCES keys(id) ON DELETE SET NULL,
  user_id             UUID REFERENCES users(id) ON DELETE SET NULL,
  version_id          UUID REFERENCES script_versions(id),
  roblox_user_id      VARCHAR(32) DEFAULT '',
  roblox_username     VARCHAR(64) DEFAULT '',
  key_session_id      UUID,
  hwid_hash           TEXT,
  event_type          VARCHAR(24) NOT NULL,                -- auth_success|auth_fail|payload_fetch|rate_limited|revoked_attempt|replay_blocked
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_script_usage_created ON script_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_script_usage_key ON script_usage(key_id);
CREATE INDEX IF NOT EXISTS idx_script_usage_event ON script_usage(event_type);

-- ============================================================================
-- audit_logs — every sensitive admin action
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id              BIGSERIAL PRIMARY KEY,
  actor_user_id   UUID REFERENCES users(id),
  action          VARCHAR(60) NOT NULL,
  target_type     VARCHAR(30) DEFAULT '',
  target_id       TEXT DEFAULT '',
  details         JSONB DEFAULT '{}',
  ip_hash         TEXT DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- ============================================================================
-- security_events — login failures, lockouts, suspicious activity
-- ============================================================================
CREATE TABLE IF NOT EXISTS security_events (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES users(id),
  event_type  VARCHAR(40) NOT NULL,
  ip_hash     TEXT DEFAULT '',
  details     JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at);

-- ============================================================================
-- configuration — simple key/value site config, editable from admin panel
-- ============================================================================
CREATE TABLE IF NOT EXISTS configuration (
  key         VARCHAR(60) PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO configuration (key, value) VALUES
  ('discord_invite_url', 'https://discord.gg/your-invite'),
  ('script_status', 'online'),
  ('current_version', '1.0.0')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- rate_limit_hits — DB-backed rate limiting (this app runs on serverless
-- functions with no shared memory between invocations, so an in-process
-- counter would not work reliably)
-- ============================================================================
CREATE TABLE IF NOT EXISTS rate_limit_hits (
  id          BIGSERIAL PRIMARY KEY,
  bucket      TEXT NOT NULL,          -- e.g. "login:<64-char sha256 iphash>" or "loader_auth_key:<64-char sha256 keyhash>" — TEXT deliberately, a fixed VARCHAR here has already been too short once
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_bucket_time ON rate_limit_hits(bucket, created_at);

-- ============================================================================
-- Upgrade path for existing databases — CREATE TABLE IF NOT EXISTS above is
-- a no-op once the table exists, so new columns need to be added explicitly.
-- ============================================================================
ALTER TABLE keys ALTER COLUMN key_preview TYPE VARCHAR(48);
ALTER TABLE keys ADD COLUMN IF NOT EXISTS key_encrypted TEXT NOT NULL DEFAULT '';
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(20) NOT NULL DEFAULT 'stripe';
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS crypto_payment_id TEXT DEFAULT '';
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS crypto_pay_address TEXT DEFAULT '';
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS crypto_pay_amount TEXT DEFAULT '';
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS crypto_pay_currency VARCHAR(10) DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_crypto_payment ON purchases(crypto_payment_id) WHERE crypto_payment_id != '';

-- ============================================================================
-- crypto_payment_events — IPN idempotency log, mirrors payment_events but
-- keyed on NOWPayments' payment_id since it has no separate "event id".
-- ============================================================================
CREATE TABLE IF NOT EXISTS crypto_payment_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id         TEXT NOT NULL,
  payment_status     VARCHAR(20) NOT NULL,
  payload            JSONB NOT NULL,
  processed_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- A given (payment_id, payment_status) pair should only ever be acted on
-- once — NOWPayments may redeliver the same status update.
CREATE UNIQUE INDEX IF NOT EXISTS idx_crypto_payment_events_unique ON crypto_payment_events(payment_id, payment_status);

-- ============================================================================
-- banned_ips — enforced at registration, login, and the loader auth
-- handshake (i.e. both "using the site" and "using the script").
-- ============================================================================
CREATE TABLE IF NOT EXISTS banned_ips (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip          TEXT NOT NULL UNIQUE,
  reason      TEXT DEFAULT '',
  banned_by   UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_ip TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_ip_at TIMESTAMPTZ;
ALTER TABLE rate_limit_hits ALTER COLUMN bucket TYPE TEXT;
CREATE INDEX IF NOT EXISTS idx_users_last_ip ON users(last_ip);
