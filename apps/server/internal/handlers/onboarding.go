package handlers

import (
	"encoding/json"
	"fmt"
	"slices"
	"strings"

	"cloudrive/server/internal/app"
	"cloudrive/server/internal/dtos"
	"cloudrive/server/internal/lib"
	"cloudrive/server/internal/lib/apperr"
	"cloudrive/server/internal/lib/validator"
	"cloudrive/server/internal/models"
	"cloudrive/server/internal/repositories"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

type onboardingHandler struct {
	app *app.Application
}

func (h *onboardingHandler) repo() *repositories.OnboardingSurveyRepository {
	return &h.app.Repositories.OnboardingSurvey
}

// Submit records the onboarding survey answers of the current user. The
// submission is an upsert, so retrying after a later onboarding step fails is
// safe.
func (h *onboardingHandler) Submit(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}

	req := &dtos.CreateOnboardingSurveyRequest{}
	if err := lib.ValidateRequestBody(c, req); err != nil {
		return err
	}

	if mr := validateSurvey(req); !mr.Empty() {
		return &lib.ErrValidationFailed{MessageRecord: mr}
	}

	useCases, err := json.Marshal(req.UseCases)
	if err != nil {
		return apperr.New(apperr.KindBadRequest, "Invalid use cases payload")
	}

	survey := models.OnboardingSurvey{
		UserID:               userID,
		ReferralSource:       req.ReferralSource,
		ReferralSourceDetail: textOrNil(req.ReferralSourceDetail),
		UseCases:             useCases,
		UseCaseDetail:        textOrNil(req.UseCaseDetail),
	}
	if survey.ID, err = uuid.NewV7(); err != nil {
		return err
	}

	survey, err = h.repo().UpsertByUser(c.Context(), survey)
	if err != nil {
		return err
	}

	return dtos.OK(c, survey)
}

// validateSurvey enforces the rules the per-field validator cannot express on
// a raw JSON array: at least one use case, every value in the accepted set,
// and the 255-character detail bound shared with the database CHECKs.
func validateSurvey(req *dtos.CreateOnboardingSurveyRequest) validator.MessageRecord {
	mr := validator.MessageRecord{}

	if len(req.UseCases) == 0 {
		mr["use_cases"] = []string{"at least one use case is required"}
		return mr
	}
	for _, useCase := range req.UseCases {
		if !slices.Contains(dtos.UseCases, useCase) {
			mr["use_cases"] = []string{fmt.Sprintf("use_cases may only contain %s", strings.Join(dtos.UseCases, ", "))}
			return mr
		}
	}

	if len(req.ReferralSourceDetail) > 255 {
		mr["referral_source_detail"] = []string{"referral_source_detail must be at most 255 characters"}
	}
	if len(req.UseCaseDetail) > 255 {
		mr["use_case_detail"] = []string{"use_case_detail must be at most 255 characters"}
	}

	return mr
}

// textOrNil maps an absent optional field to a SQL NULL instead of an empty
// string.
func textOrNil(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}
