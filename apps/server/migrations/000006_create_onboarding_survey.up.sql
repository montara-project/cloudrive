-- Onboarding survey: the answers a user gives while onboarding (referral
-- source and intended use cases). One row per user — the survey is part of
-- the first-run flow and is re-submittable (upsert). Requires PostgreSQL 18+
-- (uuidv7() for time-ordered id defaults).

-- ===== onboarding_surveys (one row per user) =====
CREATE TABLE IF NOT EXISTS "onboarding_surveys" (
    "id" uuid PRIMARY KEY DEFAULT uuidv7(),
    "user_id" uuid NOT NULL,
    "referral_source" text NOT NULL
        CHECK ("referral_source" IN ('search_engine', 'social_media', 'recommendation', 'community', 'github', 'other')),
    "referral_source_detail" text CHECK ("referral_source_detail" IS NULL OR length("referral_source_detail") <= 255),
    "use_cases" jsonb NOT NULL CHECK (jsonb_typeof("use_cases") = 'array'),
    "use_case_detail" text CHECK ("use_case_detail" IS NULL OR length("use_case_detail") <= 255),
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    -- one survey per user; the unique index also covers user_id lookups
    CONSTRAINT "uq_onboarding_surveys_user" UNIQUE ("user_id"),
    CONSTRAINT "fk_onboarding_surveys_user" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);
