-- Role marker mirrored from Authula user metadata ("role" key). The seeded
-- super user (SUPER_USER flag) carries "admin"; everyone else is "user".
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" text NOT NULL DEFAULT 'user';
