package lib

import (
	"errors"
	"net/http/httptest"
	"strings"
	"testing"

	"cloudrive/server/internal/dtos"

	"github.com/gofiber/fiber/v3"
)

func validationErr(t *testing.T, err error) *ErrValidationFailed {
	t.Helper()
	var ve *ErrValidationFailed
	if !errors.As(err, &ve) {
		t.Fatalf("expected ErrValidationFailed, got %v", err)
	}
	return ve
}

func runBody(t *testing.T, body string, obj Validatable) error {
	t.Helper()
	app := fiber.New()
	var out error
	app.Post("/t", func(c fiber.Ctx) error {
		out = ValidateRequestBody(c, obj)
		if out != nil {
			return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{"err": out.Error()})
		}
		return c.SendStatus(fiber.StatusOK)
	})

	req := httptest.NewRequest("POST", "/t", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	resp.Body.Close()
	return out
}

func runQuery(t *testing.T, target string, obj Validatable) error {
	t.Helper()
	app := fiber.New()
	var out error
	app.Get("/t", func(c fiber.Ctx) error {
		out = ValidateRequestQuery(c, obj)
		if out != nil {
			return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{"err": out.Error()})
		}
		return c.SendStatus(fiber.StatusOK)
	})

	req := httptest.NewRequest("GET", target, nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	resp.Body.Close()
	return out
}

func TestValidateRequestBody_RequiredFields(t *testing.T) {
	err := runBody(t, `{"name":"Acme"}`, &dtos.CreateOrganizationRequest{})
	ve := validationErr(t, err)
	if msgs := ve.MessageRecord["slug"]; len(msgs) == 0 {
		t.Fatalf("expected slug error, got %v", ve.MessageRecord)
	}
}

func TestValidateRequestBody_Valid(t *testing.T) {
	req := &dtos.CreateOrganizationRequest{}
	if err := runBody(t, `{"name":"Acme","slug":"acme"}`, req); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if req.Name != "Acme" || req.Slug != "acme" {
		t.Fatalf("struct not bound: %+v", req)
	}
}

func TestValidateRequestBody_EmailRule(t *testing.T) {
	err := runBody(t, `{"email":"not-an-email"}`, &dtos.CreateInvitationRequest{})
	ve := validationErr(t, err)
	if msgs := ve.MessageRecord["email"]; len(msgs) == 0 {
		t.Fatalf("expected email error, got %v", ve.MessageRecord)
	}
}

func TestValidateRequestBody_OptionalEnumAbsentPasses(t *testing.T) {
	req := &dtos.CreateInvitationRequest{}
	if err := runBody(t, `{"email":"a@b.co"}`, req); err != nil {
		t.Fatalf("absent optional role should pass, got %v", err)
	}
}

func TestValidateRequestBody_OptionalEnumRejectsBadValue(t *testing.T) {
	err := runBody(t, `{"email":"a@b.co","role":"owner"}`, &dtos.CreateInvitationRequest{})
	validationErr(t, err)
}

func TestValidateRequestBody_EmptyBodyFailsRequired(t *testing.T) {
	err := runBody(t, ``, &dtos.CreateWorkspaceRequest{})
	ve := validationErr(t, err)
	if msgs := ve.MessageRecord["name"]; len(msgs) == 0 {
		t.Fatalf("expected name error, got %v", ve.MessageRecord)
	}
}

func TestValidateRequestBody_EmptyBodyAllowedWhenAllOptional(t *testing.T) {
	req := &dtos.CreateS3CredentialRequest{}
	if err := runBody(t, ``, req); err != nil {
		t.Fatalf("empty body should pass all-optional DTO, got %v", err)
	}
}

func TestValidateRequestBody_MissingUUIDFailsRequired(t *testing.T) {
	err := runBody(t, `{}`, &dtos.AddMemberRequest{})
	ve := validationErr(t, err)
	if msgs := ve.MessageRecord["user_id"]; len(msgs) == 0 {
		t.Fatalf("expected user_id error, got %v", ve.MessageRecord)
	}
}

func TestValidateRequestQuery_OptionalDefaultsPass(t *testing.T) {
	q := &dtos.ListQuery{}
	if err := runQuery(t, "/t", q); err != nil {
		t.Fatalf("empty query should pass, got %v", err)
	}
}

func TestValidateRequestQuery_InvalidOrderFails(t *testing.T) {
	err := runQuery(t, "/t?order=sideways", &dtos.ListQuery{})
	validationErr(t, err)
}

func TestValidateRequestQuery_ValidParamsPass(t *testing.T) {
	q := &dtos.ListQuery{}
	if err := runQuery(t, "/t?offset=20&limit=10&order=asc", q); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if q.Offset != 20 || q.Limit != 10 || q.Order != "asc" {
		t.Fatalf("query not bound: %+v", q)
	}
}

func TestValidateRequestBody_EmptyStringTreatedAsAbsent(t *testing.T) {
	// An explicit "" on an optional enum/format field behaves like an absent
	// key: it passes validation and the handler default applies.
	req := &dtos.CreateInvitationRequest{}
	if err := runBody(t, `{"email":"a@b.co","role":""}`, req); err != nil {
		t.Fatalf("empty optional role should pass, got %v", err)
	}
}

func TestValidateRequestBody_EmptyStringStatusPasses(t *testing.T) {
	req := &dtos.UpdateStorageAccountRequest{}
	if err := runBody(t, `{"status":""}`, req); err != nil {
		t.Fatalf("empty status should pass as no-change, got %v", err)
	}
}

func TestValidateRequestBody_EmptyStringStillFailsRequired(t *testing.T) {
	err := runBody(t, `{"email":""}`, &dtos.CreateInvitationRequest{})
	validationErr(t, err)
}

func TestValidateRequestQuery_EmptyParamTreatedAsAbsent(t *testing.T) {
	q := &dtos.ListQuery{}
	if err := runQuery(t, "/t?order=", q); err != nil {
		t.Fatalf("empty order should pass like an absent param, got %v", err)
	}
}
