package lib

import (
	"encoding/json"
	"fmt"

	"cloudrive/server/internal/lib/validator"

	"github.com/gofiber/fiber/v3"
)

type ErrValidationFailed struct {
	MessageRecord validator.MessageRecord
}

func (e ErrValidationFailed) Error() string {
	return fmt.Sprintf("%v", e.MessageRecord)
}

type Validatable interface {
	Validate(v *validator.MapValidator)
}

func ValidateStruct(obj Validatable) error {
	data := make(map[string]interface{})
	if jsonData, err := json.Marshal(obj); err == nil {
		_ = json.Unmarshal(jsonData, &data)
	}

	return validateDict(obj, data)
}

func ValidateRequestQuery(c fiber.Ctx, obj Validatable) error {
	if err := c.Bind().Query(obj); err != nil {
		return err
	}

	data := make(map[string]interface{}, len(c.Queries()))
	for key, val := range c.Queries() {
		data[key] = val
	}

	return validateDict(obj, data)
}

// ValidateRequestBody validates the raw JSON object before binding it into
// obj, so optional fields that are absent stay absent (an empty struct field
// would otherwise fail rules like Email/WithinS). An empty body is treated
// as an empty object.
func ValidateRequestBody(c fiber.Ctx, obj Validatable) error {
	body := c.Body()

	data := make(map[string]interface{})
	if len(body) > 0 {
		if err := json.Unmarshal(body, &data); err != nil {
			return err
		}
	}

	if err := validateDict(obj, data); err != nil {
		return err
	}

	if len(body) == 0 {
		return nil
	}
	return c.Bind().Body(obj)
}

func validateDict(obj Validatable, data map[string]interface{}) error {
	v := validator.NewMapValidator()
	obj.Validate(v)

	mr, passed := v.Validate(data)
	if !passed {
		return &ErrValidationFailed{MessageRecord: mr}
	}

	return nil
}

func WrapValidationError(mr validator.MessageRecord) map[string]interface{} {
	return map[string]interface{}{
		"message": "validation failed",
		"errors":  mr,
	}
}
