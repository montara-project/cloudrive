package repositories

import (
	"context"

	"cloudrive/server/internal/models"
)

// OnboardingSurveyRepository manages onboarding_surveys.
type OnboardingSurveyRepository struct {
	BaseRepository
}

// UpsertByUser inserts the survey for the user, or replaces the answers when
// one already exists. The caller sets ID (uuid.NewV7). ON CONFLICT targets
// the per-user unique constraint explicitly, and RETURNING hands back the
// surviving row so the caller sees the real id and timestamps either way.
func (r *OnboardingSurveyRepository) UpsertByUser(ctx context.Context, s models.OnboardingSurvey) (models.OnboardingSurvey, error) {
	query := `
		INSERT INTO onboarding_surveys (id, user_id, referral_source, referral_source_detail, use_cases, use_case_detail)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (user_id) DO UPDATE
		SET referral_source = EXCLUDED.referral_source,
		    referral_source_detail = EXCLUDED.referral_source_detail,
		    use_cases = EXCLUDED.use_cases,
		    use_case_detail = EXCLUDED.use_case_detail,
		    updated_at = now()
		RETURNING id, created_at, updated_at`

	// pgx encodes []byte as a bytea literal, which jsonb rejects; jsonb
	// columns are sent as their JSON text instead.
	var useCases any
	if len(s.UseCases) > 0 {
		useCases = string(s.UseCases)
	}

	out := s
	err := r.queryRowContext(ctx, query,
		s.ID, s.UserID, s.ReferralSource, s.ReferralSourceDetail, useCases, s.UseCaseDetail,
	).Scan(&out.ID, &out.CreatedAt, &out.UpdatedAt)
	if err != nil {
		return models.OnboardingSurvey{}, err
	}
	return out, nil
}
