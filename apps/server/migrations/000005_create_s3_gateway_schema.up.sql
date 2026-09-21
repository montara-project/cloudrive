-- S3-compatible gateway domain: SigV4 credentials issued by Cloudrive (the
-- gateway's own access keys, distinct from provider credentials) and the
-- bucket → storage account mapping. Requires PostgreSQL 18+ (uuidv7()).

-- ===== s3_credentials (SigV4 access keys for the S3 gateway) =====
-- The secret part is AES-256-GCM encrypted by the application before this row
-- is written (same vault rules as storage_account_secrets); the plaintext is
-- shown once at creation time and only decrypted in memory to verify request
-- signatures.
CREATE TABLE IF NOT EXISTS "s3_credentials" (
    "id" uuid PRIMARY KEY DEFAULT uuidv7(),
    "organization_id" uuid NOT NULL,
    "workspace_id" uuid NOT NULL,
    "user_id" uuid NOT NULL REFERENCES "users" ("id") ON DELETE RESTRICT,
    "access_key_id" text NOT NULL UNIQUE CHECK (length("access_key_id") BETWEEN 16 AND 128),
    "secret_key_encrypted" text NOT NULL CHECK (length("secret_key_encrypted") BETWEEN 16 AND 65536),
    "key_id" text NOT NULL,
    "label" text CHECK ("label" IS NULL OR length("label") BETWEEN 1 AND 255),
    "status" text NOT NULL DEFAULT 'active' CHECK ("status" IN ('active', 'revoked')),
    "last_used_at" timestamptz,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    -- the credential must belong to a workspace of the carried organization
    CONSTRAINT "fk_s3_credentials_workspace" FOREIGN KEY ("workspace_id", "organization_id")
        REFERENCES "workspaces" ("id", "organization_id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_s3_credentials_organization_id" ON "s3_credentials" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_s3_credentials_user_id" ON "s3_credentials" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_s3_credentials_workspace_id" ON "s3_credentials" ("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_s3_credentials_status" ON "s3_credentials" ("status");

-- ===== s3_buckets (mapping: S3 bucket name → storage account + root prefix) =====
-- Bucket names live in one global namespace (S3 semantics): the name must be
-- unique across the whole deployment. Every object written through the gateway
-- is stored under the mapped storage account, below root_prefix.
CREATE TABLE IF NOT EXISTS "s3_buckets" (
    "id" uuid PRIMARY KEY DEFAULT uuidv7(),
    "organization_id" uuid NOT NULL,
    "workspace_id" uuid NOT NULL,
    "name" text NOT NULL UNIQUE CHECK ("name" ~ '^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$'),
    "storage_account_id" uuid NOT NULL REFERENCES "storage_accounts" ("id") ON DELETE RESTRICT,
    "root_prefix" text NOT NULL DEFAULT '' CHECK ("root_prefix" = '' OR "root_prefix" ~ '^[^/].*/$'),
    "created_by" uuid NOT NULL REFERENCES "users" ("id") ON DELETE RESTRICT,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    -- the bucket must belong to a workspace of the carried organization
    CONSTRAINT "fk_s3_buckets_workspace" FOREIGN KEY ("workspace_id", "organization_id")
        REFERENCES "workspaces" ("id", "organization_id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_s3_buckets_organization_id" ON "s3_buckets" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_s3_buckets_workspace_id" ON "s3_buckets" ("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_s3_buckets_storage_account_id" ON "s3_buckets" ("storage_account_id");
