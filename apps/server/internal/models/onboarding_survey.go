package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// OnboardingSurvey holds the answers a user gives during first-run onboarding
// (referral source and intended use cases). One row per user; submissions are
// upserts, so re-submitting replaces the previous answers.
type OnboardingSurvey struct {
	ID                   uuid.UUID       `db:"id" json:"id"`
	UserID               uuid.UUID       `db:"user_id" json:"user_id"`
	ReferralSource       string          `db:"referral_source" json:"referral_source"`
	ReferralSourceDetail *string         `db:"referral_source_detail" json:"referral_source_detail,omitempty"`
	UseCases             json.RawMessage `db:"use_cases" json:"use_cases"`
	UseCaseDetail        *string         `db:"use_case_detail" json:"use_case_detail,omitempty"`
	CreatedAt            time.Time       `db:"created_at" json:"created_at"`
	UpdatedAt            time.Time       `db:"updated_at" json:"updated_at"`
}
