package dtos

import "cloudrive/server/internal/lib/validator"

// ReferralSources enumerates the accepted answers for "where did you hear
// about Cloudrive?". Must stay in sync with the CHECK constraint on
// onboarding_surveys.referral_source (migration 000006).
var ReferralSources = []string{
	"search_engine",
	"social_media",
	"recommendation",
	"community",
	"github",
	"other",
}

// UseCases enumerates the accepted answers for "what will you use Cloudrive
// for?". Must stay in sync with the frontend option list; membership of each
// submitted value is enforced by the handler.
var UseCases = []string{
	"personal_backup",
	"team_collaboration",
	"s3_api_integration",
	"media_archive",
	"development",
	"other",
}

type CreateOnboardingSurveyRequest struct {
	ReferralSource       string   `json:"referral_source"`
	ReferralSourceDetail string   `json:"referral_source_detail"`
	UseCases             []string `json:"use_cases"`
	UseCaseDetail        string   `json:"use_case_detail"`
}

func (dto CreateOnboardingSurveyRequest) Validate(v *validator.MapValidator) {
	v.Field("referral_source").Required().String().WithinS(ReferralSources...)
	v.Field("referral_source_detail").String()
	// use_cases is a JSON array; the handler enforces membership and the
	// at-least-one rule, mirroring the storage account DTOs.
	v.Field("use_cases").Required()
	v.Field("use_case_detail").String()
}
