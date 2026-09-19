-- Storage provider domain: the provider catalog, connected storage accounts
-- (one provider can have several accounts per workspace), and the credential
-- vault. Requires PostgreSQL 18+ (uuidv7() for time-ordered id defaults).

-- ===== providers (global catalog of provider types) =====
CREATE TABLE IF NOT EXISTS "providers" (
    "id" uuid PRIMARY KEY DEFAULT uuidv7(),
    "slug" text NOT NULL UNIQUE CHECK (length("slug") BETWEEN 1 AND 100),
    "name" text NOT NULL CHECK (length("name") BETWEEN 1 AND 255),
    "protocol" text NOT NULL CHECK ("protocol" IN ('oauth2_cloud', 's3_compatible', 'webdav', 'ftp')),
    "auth_type" text NOT NULL CHECK ("auth_type" IN ('oauth2', 'access_key', 'password')),
    "capabilities" jsonb,
    "is_active" boolean NOT NULL DEFAULT true,
    "deleted_at" timestamptz,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- ===== storage_accounts (a connected provider account inside one workspace) =====
CREATE TABLE IF NOT EXISTS "storage_accounts" (
    "id" uuid PRIMARY KEY DEFAULT uuidv7(),
    "organization_id" uuid NOT NULL,
    "workspace_id" uuid NOT NULL,
    "provider_id" uuid NOT NULL REFERENCES "providers" ("id") ON DELETE RESTRICT,
    "owner_user_id" uuid NOT NULL REFERENCES "users" ("id") ON DELETE RESTRICT,
    "display_name" text NOT NULL CHECK (length("display_name") BETWEEN 1 AND 255),
    "account_email" text CHECK ("account_email" IS NULL OR length("account_email") <= 254),
    "external_account_id" text NOT NULL CHECK (length("external_account_id") BETWEEN 1 AND 512),
    "settings" jsonb,
    "status" text NOT NULL DEFAULT 'pending_auth'
        CHECK ("status" IN ('pending_auth', 'active', 'expired', 'revoked', 'error')),
    "last_synced_at" timestamptz,
    "deleted_at" timestamptz,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "uq_storage_accounts_workspace_provider_external" UNIQUE ("workspace_id", "provider_id", "external_account_id"),
    -- the account must belong to a workspace of the carried organization
    CONSTRAINT "fk_storage_accounts_workspace" FOREIGN KEY ("workspace_id", "organization_id")
        REFERENCES "workspaces" ("id", "organization_id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_storage_accounts_organization_id" ON "storage_accounts" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_storage_accounts_provider_id" ON "storage_accounts" ("provider_id");
CREATE INDEX IF NOT EXISTS "idx_storage_accounts_owner_user_id" ON "storage_accounts" ("owner_user_id");

-- ===== storage_account_secrets (encrypted credential vault, 1:1) =====
-- Credentials (OAuth tokens, access keys, passwords) are AES-256-GCM
-- encrypted by the application before this row is written and are decrypted
-- only in memory when a provider call needs them. key_id names the key that
-- encrypted the blob so old rows can be found and re-encrypted during key
-- rotation. The application refuses to start without encryption keys
-- configured, so no plaintext credential path to this table exists.
CREATE TABLE IF NOT EXISTS "storage_account_secrets" (
    "storage_account_id" uuid PRIMARY KEY REFERENCES "storage_accounts" ("id") ON DELETE CASCADE,
    "credentials_encrypted" text NOT NULL CHECK (length("credentials_encrypted") BETWEEN 16 AND 65536),
    "key_id" text NOT NULL,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
);
