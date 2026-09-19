-- Mirror of Authula's users table in the application's public schema.
-- Authula remains the source of truth for account lifecycle; rows are kept
-- in sync through Authula's user service hooks (see cmd/api/authula.go),
-- which always supply the id — the uuidv7() default only covers direct
-- inserts. Requires PostgreSQL 18+ (uuidv7()).
-- Authula guarantees one account per email (OAuth sign-in links by email),
-- so email can be unique here.
CREATE TABLE IF NOT EXISTS "users" (
    "id" uuid PRIMARY KEY DEFAULT uuidv7(),
    "email" text NOT NULL UNIQUE,
    "first_name" text NOT NULL,
    "last_name" text,
    "image" text,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
);
