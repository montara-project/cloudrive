-- Multi-tenant hierarchy: Organization as the primary tenant, Workspace as a
-- sub-space within it. The hierarchy is enforced with composite foreign keys so
-- a workspace member row can only exist when the user belongs to the owning
-- organization, and every workspace-scoped row carries organization_id, which
-- keeps the schema ready for row-level security later.
-- Requires PostgreSQL 18+ (uuidv7() for time-ordered id defaults).

-- ===== organizations (primary tenant) =====
CREATE TABLE IF NOT EXISTS "organizations" (
    "id" uuid PRIMARY KEY DEFAULT uuidv7(),
    "name" text NOT NULL CHECK (length("name") BETWEEN 1 AND 255),
    "slug" text NOT NULL UNIQUE CHECK (length("slug") BETWEEN 1 AND 255),
    "logo" text,
    "created_by" uuid NOT NULL REFERENCES "users" ("id"),
    "deleted_at" timestamptz,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_organizations_created_by" ON "organizations" ("created_by");

-- ===== organization_members =====
CREATE TABLE IF NOT EXISTS "organization_members" (
    "id" uuid PRIMARY KEY DEFAULT uuidv7(),
    "organization_id" uuid NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
    "user_id" uuid NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
    "role" text NOT NULL DEFAULT 'member' CHECK ("role" IN ('owner', 'admin', 'member')),
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "uq_organization_members_org_user" UNIQUE ("organization_id", "user_id")
);

CREATE INDEX IF NOT EXISTS "idx_organization_members_user_id" ON "organization_members" ("user_id");

-- exactly one owner per organization
CREATE UNIQUE INDEX IF NOT EXISTS "uq_organization_members_owner"
    ON "organization_members" ("organization_id") WHERE "role" = 'owner';

-- ===== workspaces (sub-spaces of an organization) =====
CREATE TABLE IF NOT EXISTS "workspaces" (
    "id" uuid PRIMARY KEY DEFAULT uuidv7(),
    "organization_id" uuid NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
    "name" text NOT NULL CHECK (length("name") BETWEEN 1 AND 255),
    "slug" text NOT NULL CHECK (length("slug") BETWEEN 1 AND 255),
    "description" text,
    "created_by" uuid NOT NULL REFERENCES "users" ("id"),
    "deleted_at" timestamptz,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    -- referenced by the composite foreign key from workspace_members (and, later,
    -- domain tables such as sources/files) so a child row can never point at a
    -- workspace that belongs to a different organization
    CONSTRAINT "uq_workspaces_id_org" UNIQUE ("id", "organization_id"),
    CONSTRAINT "uq_workspaces_org_slug" UNIQUE ("organization_id", "slug")
);

CREATE INDEX IF NOT EXISTS "idx_workspaces_organization_id" ON "workspaces" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_workspaces_created_by" ON "workspaces" ("created_by");

-- ===== workspace_members =====
CREATE TABLE IF NOT EXISTS "workspace_members" (
    "id" uuid PRIMARY KEY DEFAULT uuidv7(),
    "workspace_id" uuid NOT NULL,
    "organization_id" uuid NOT NULL,
    "user_id" uuid NOT NULL,
    "role" text NOT NULL DEFAULT 'member' CHECK ("role" IN ('admin', 'member', 'viewer')),
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "uq_workspace_members_workspace_user" UNIQUE ("workspace_id", "user_id"),
    -- the workspace must belong to the organization carried on this row
    CONSTRAINT "fk_workspace_members_workspace" FOREIGN KEY ("workspace_id", "organization_id")
        REFERENCES "workspaces" ("id", "organization_id") ON DELETE CASCADE,
    -- the user must be a member of that organization; leaving the organization
    -- cascades the user out of every workspace of that organization
    CONSTRAINT "fk_workspace_members_org_member" FOREIGN KEY ("organization_id", "user_id")
        REFERENCES "organization_members" ("organization_id", "user_id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_workspace_members_workspace_id" ON "workspace_members" ("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_workspace_members_organization_id" ON "workspace_members" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_workspace_members_user_id" ON "workspace_members" ("user_id");

-- ===== organization_invitations =====
CREATE TABLE IF NOT EXISTS "organization_invitations" (
    "id" uuid PRIMARY KEY DEFAULT uuidv7(),
    "organization_id" uuid NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
    "email" text NOT NULL CHECK (length("email") <= 254),
    "role" text NOT NULL DEFAULT 'member' CHECK ("role" IN ('admin', 'member')),
    "status" text NOT NULL DEFAULT 'pending'
        CHECK ("status" IN ('pending', 'accepted', 'rejected', 'revoked', 'expired')),
    "token" text NOT NULL UNIQUE,
    "invited_by" uuid NOT NULL REFERENCES "users" ("id"),
    "expires_at" timestamptz NOT NULL,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_organization_invitations_organization_id" ON "organization_invitations" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_organization_invitations_email" ON "organization_invitations" ("email");

-- a single pending invitation per email per organization
CREATE UNIQUE INDEX IF NOT EXISTS "uq_organization_invitations_pending"
    ON "organization_invitations" ("organization_id", "email") WHERE "status" = 'pending';
