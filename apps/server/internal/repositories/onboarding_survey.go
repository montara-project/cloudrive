package repositories

import (
	"context"
	"time"

	"cloudrive/server/internal/models"

	"braces.dev/errtrace"
	"github.com/google/uuid"
)

type OnboardingSurveyRepository struct {
	BaseRepository
}

// UpsertByUser inserts the survey for the user, or replaces the answers when
// one already exists. ON CONFLICT targets the per-user unique constraint
// explicitly, and RETURNING hands back the surviving row so the caller sees
// the real id and timestamps either way.
func (r OnboardingSurveyRepository) UpsertByUser(survey *models.OnboardingSurvey) error {
	return r.upsertByUserExec(r.DB, survey)
}

func (r OnboardingSurveyRepository) upsertByUserExec(exc Executor, survey *models.OnboardingSurvey) error {
	if survey.ID == uuid.Nil {
		id, err := uuid.NewV7()
		if err != nil {
			return errtrace.Errorf("error generating id: %w", err)
		}
		survey.ID = id
	}

	query := `
		INSERT INTO "onboarding_surveys" ("id", "user_id", "referral_source", "referral_source_detail", "use_cases", "use_case_detail")
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT ("user_id") DO UPDATE
		SET "referral_source" = EXCLUDED."referral_source",
		    "referral_source_detail" = EXCLUDED."referral_source_detail",
		    "use_cases" = EXCLUDED."use_cases",
		    "use_case_detail" = EXCLUDED."use_case_detail",
		    "updated_at" = now()
		RETURNING "id", "created_at", "updated_at";
	`

	r.debugQuery(query)

	// lib/pq encodes []byte as a bytea literal, which jsonb rejects; jsonb
	// columns are sent as their JSON text instead.
	var useCases any
	if len(survey.UseCases) > 0 {
		useCases = string(survey.UseCases)
	}

	args := []any{
		survey.ID,
		survey.UserID,
		survey.ReferralSource,
		survey.ReferralSourceDetail,
		useCases,
		survey.UseCaseDetail,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	err := exc.QueryRowContext(ctx, query, args...).Scan(&survey.ID, &survey.CreatedAt, &survey.UpdatedAt)
	if err != nil {
		return errtrace.Errorf("error scanning row: %w", err)
	}

	return nil
}
