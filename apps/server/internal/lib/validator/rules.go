package validator

import (
	"encoding/base64"
	"fmt"
	"reflect"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/google/uuid"
)

type rule func(path path, data interface{}) (interface{}, MessageRecord, bool)

// Map validates that the provided value is a map with string keys.
//
// Note: Only string keys are supported, as this library is designed to
// validate JSON objects, where keys are expected to be strings.
func (v *FieldValidator) Map(f func(v *MapValidator)) *FieldValidator {
	rule := func(path path, data interface{}) (interface{}, MessageRecord, bool) {
		if data == nil {
			return data, make(MessageRecord), true
		}

		uv := unwrapValue(data)

		val := reflect.ValueOf(uv)
		if val.Kind() != reflect.Map {
			msg := fmt.Sprintf("%s is not a map", path.last())
			mr := make(MessageRecord)
			mr.InsertMessage(path, msg)
			return nil, mr, false
		}

		dict, ok := data.(map[string]interface{})
		if !ok {
			// Go is a statically typed language, map[string]string and map[string]interface{}
			// are not considered same type. In the scenario where the type casting fails, we
			// will convert it into map[string]interface{} manually.

			converted := make(map[string]interface{})

			for _, key := range val.MapKeys() {
				// Ensure the key is a string, since we're converting to map[string]interface{}
				keyStr, ok := key.Interface().(string)
				if !ok {
					msg := fmt.Sprintf("%s is not a map with string keys", path.last())
					mr := make(MessageRecord)
					mr.InsertMessage(path, msg)
					return nil, mr, false
				}

				// Add the key-value pair to the new map[string]interface{}
				converted[keyStr] = val.MapIndex(key).Interface()
			}

			dict = converted
		}

		mv := newMapValidatorWithPath(v.path)
		f(mv)

		mr, passes := mv.Validate(dict)
		return dict, mr, passes
	}

	v.registerRule(rule)
	return v
}

func (v *FieldValidator) AnySlice() *FieldValidator {
	return v.Slice(func(v *FieldValidator) {})
}

func (v *FieldValidator) Slice(f func(v *FieldValidator)) *FieldValidator {
	rule := func(path path, data interface{}) (interface{}, MessageRecord, bool) {
		if data == nil {
			return data, make(MessageRecord), true
		}

		uv := unwrapValue(data)

		val := reflect.ValueOf(uv)
		if val.Kind() != reflect.Slice {
			msg := fmt.Sprintf("%s is not a slice", path.last())
			mr := make(MessageRecord)
			mr.InsertMessage(path, msg)
			return nil, mr, false
		}

		sumMr := make(MessageRecord)

		for i := 0; i < val.Len(); i++ {
			fieldPath := append(v.path, strconv.Itoa(i))
			fv := &FieldValidator{path: fieldPath}
			f(fv)

			el := val.Index(i).Interface()
			mr, passes := fv.Validate(el)
			if !passes {
				sumMr = sumMr.Append(mr)
			}
		}

		passes := sumMr.Empty()
		return val.Interface(), sumMr, passes
	}

	v.registerRule(rule)
	return v
}

func (v *FieldValidator) Required() *FieldValidator {
	// register required validation
	rule := func(path path, data interface{}) (interface{}, MessageRecord, bool) {
		passes := true

		val := reflect.ValueOf(data)
		switch val.Kind() {
		case reflect.String:
			if val.String() == "" {
				passes = false
			}
		case reflect.Ptr:
			if val.IsNil() {
				passes = false
			} else {
				elem := val.Elem()
				if elem.Kind() == reflect.String && elem.String() == "" {
					passes = false
				}
			}
		case reflect.Slice, reflect.Map:
			if val.IsNil() {
				passes = false
			}
		case reflect.Invalid:
			passes = false
		}

		if !passes {
			msg := fmt.Sprintf("%s is required", path.last())
			mr := make(MessageRecord)
			mr.InsertMessage(path, msg)
			return data, mr, passes
		}

		return data, make(MessageRecord), true
	}

	v.registerRule(rule)
	return v
}

func (v *FieldValidator) Alpha() *FieldValidator {
	rule := func(path path, data interface{}) (interface{}, MessageRecord, bool) {
		if data == nil {
			return data, make(MessageRecord), true
		}

		passes := true

		if str, ok := unwrapValue(data).(string); ok {
			for _, c := range str {
				if !unicode.IsLetter(c) {
					passes = false
				}
			}
		} else {
			passes = false
		}

		if !passes {
			msg := fmt.Sprintf("%s may only contain letters", path.last())
			mr := make(MessageRecord)
			mr.InsertMessage(path, msg)
			return data, mr, false
		}

		return data, make(MessageRecord), true
	}

	v.registerRule(rule)
	return v
}

func (v *FieldValidator) Num() *FieldValidator {
	rule := func(path path, data interface{}) (interface{}, MessageRecord, bool) {
		if data == nil {
			return data, make(MessageRecord), true
		}

		uv := unwrapValue(data)

		switch uv.(type) {
		case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64, float32, float64:
			return data, make(MessageRecord), true
		default:
			msg := fmt.Sprintf("%s must be a number", path.last())
			mr := make(MessageRecord)
			mr.InsertMessage(path, msg)
			return data, mr, false
		}
	}

	v.registerRule(rule)
	return v
}

func (v *FieldValidator) String() *FieldValidator {
	rule := func(path path, data interface{}) (interface{}, MessageRecord, bool) {
		if data == nil {
			return data, make(MessageRecord), true
		}

		if _, ok := unwrapValue(data).(string); !ok {
			msg := fmt.Sprintf("%s must be a string", path.last())
			mr := make(MessageRecord)
			mr.InsertMessage(path, msg)
			return data, mr, false
		}

		return data, make(MessageRecord), true
	}

	v.registerRule(rule)
	return v
}

func (v *FieldValidator) Regex(pattern string) *FieldValidator {
	return v.Match(regexp.MustCompile(pattern))
}

// Match validates a string against a pre-compiled pattern; prefer it over
// Regex when the pattern is a package-level var so it is not recompiled per
// request.
func (v *FieldValidator) Match(re *regexp.Regexp) *FieldValidator {
	rule := func(path path, data interface{}) (interface{}, MessageRecord, bool) {
		if data == nil {
			return data, make(MessageRecord), true
		}

		str, ok := unwrapValue(data).(string)
		if !ok || !re.MatchString(str) {
			msg := fmt.Sprintf("%s must match the pattern %s", path.last(), re.String())
			mr := make(MessageRecord)
			mr.InsertMessage(path, msg)
			return data, mr, false
		}

		return data, make(MessageRecord), true
	}

	v.registerRule(rule)
	return v
}

var emailPattern = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

func (v *FieldValidator) Email() *FieldValidator {
	rule := func(path path, data interface{}) (interface{}, MessageRecord, bool) {
		if data == nil {
			return data, make(MessageRecord), true
		}
		str, ok := unwrapValue(data).(string)
		if !ok || !emailPattern.MatchString(str) {
			msg := fmt.Sprintf("%s must be a valid email address", path.last())
			mr := make(MessageRecord)
			mr.InsertMessage(path, msg)
			return data, mr, false
		}

		return data, make(MessageRecord), true
	}

	v.registerRule(rule)
	return v
}

func (v *FieldValidator) Bool() *FieldValidator {
	rule := func(path path, data interface{}) (interface{}, MessageRecord, bool) {
		if data == nil {
			return data, make(MessageRecord), true
		}

		if _, ok := unwrapValue(data).(bool); !ok {
			msg := fmt.Sprintf("%s must be true or false", path.last())
			mr := make(MessageRecord)
			mr.InsertMessage(path, msg)
			return data, mr, false
		}

		return data, make(MessageRecord), true
	}

	v.registerRule(rule)
	return v
}

func (v *FieldValidator) Date() *FieldValidator {
	rule := func(path path, data interface{}) (interface{}, MessageRecord, bool) {
		if data == nil {
			return data, make(MessageRecord), true
		}

		dateStr, ok := unwrapValue(data).(string)
		if !ok {
			msg := fmt.Sprintf("%s must be a string representing a date", path.last())
			mr := make(MessageRecord)
			mr.InsertMessage(path, msg)
			return data, mr, false
		}

		_, err := time.Parse(time.RFC3339, dateStr)
		if err != nil {
			msg := fmt.Sprintf("%s must be a valid RFC3339 date-time", path.last())
			mr := make(MessageRecord)
			mr.InsertMessage(path, msg)
			return data, mr, false
		}

		return data, make(MessageRecord), true
	}

	v.registerRule(rule)
	return v
}

// toFloat converts any numeric value to float64; non-numeric values report
// false so rules can choose their own leniency.
func toFloat(data interface{}) (float64, bool) {
	switch v := data.(type) {
	case int:
		return float64(v), true
	case int8:
		return float64(v), true
	case int16:
		return float64(v), true
	case int32:
		return float64(v), true
	case int64:
		return float64(v), true
	case uint:
		return float64(v), true
	case uint8:
		return float64(v), true
	case uint16:
		return float64(v), true
	case uint32:
		return float64(v), true
	case uint64:
		return float64(v), true
	case float32:
		return float64(v), true
	case float64:
		return v, true
	}
	return 0, false
}

func (v *FieldValidator) Min(n float64) *FieldValidator {
	rule := func(path path, data interface{}) (interface{}, MessageRecord, bool) {
		passes := true

		if f, ok := toFloat(unwrapValue(data)); ok {
			passes = f >= n
		}

		if !passes {
			msg := fmt.Sprintf("%s must be at least %v", path.last(), n)
			mr := make(MessageRecord)
			mr.InsertMessage(path, msg)
			return data, mr, false
		}

		return data, make(MessageRecord), true
	}

	v.registerRule(rule)
	return v
}

func (v *FieldValidator) Max(n float64) *FieldValidator {
	rule := func(path path, data interface{}) (interface{}, MessageRecord, bool) {
		passes := true

		if f, ok := toFloat(unwrapValue(data)); ok {
			passes = f <= n
		}

		if !passes {
			msg := fmt.Sprintf("%s may not be greater than %v", path.last(), n)
			mr := make(MessageRecord)
			mr.InsertMessage(path, msg)
			return data, mr, false
		}

		return data, make(MessageRecord), true
	}

	v.registerRule(rule)
	return v
}

func (v *FieldValidator) MinS(n int) *FieldValidator {
	rule := func(path path, data interface{}) (interface{}, MessageRecord, bool) {
		if str, ok := unwrapValue(data).(string); ok {
			if len(str) < n {
				msg := fmt.Sprintf("%s must be at least %d characters", path.last(), n)
				mr := make(MessageRecord)
				mr.InsertMessage(path, msg)
				return data, mr, false
			}
		}

		return data, make(MessageRecord), true
	}

	v.registerRule(rule)
	return v
}

func (v *FieldValidator) MaxS(n int) *FieldValidator {
	rule := func(path path, data interface{}) (interface{}, MessageRecord, bool) {
		if str, ok := unwrapValue(data).(string); ok {
			if len(str) > n {
				msg := fmt.Sprintf("%s may not be greater than %d characters", path.last(), n)
				mr := make(MessageRecord)
				mr.InsertMessage(path, msg)
				return data, mr, false
			}
		}

		return data, make(MessageRecord), true
	}

	v.registerRule(rule)
	return v
}

func (v *FieldValidator) MaxLen(n int) *FieldValidator {
	rule := func(path path, data interface{}) (interface{}, MessageRecord, bool) {
		uv := unwrapValue(data)
		val := reflect.ValueOf(uv)

		if val.Kind() == reflect.Slice {
			if val.Len() > n {
				msg := fmt.Sprintf("%s may not contain more than %d items", path.last(), n)
				mr := make(MessageRecord)
				mr.InsertMessage(path, msg)
				return data, mr, false
			}
		}

		return data, make(MessageRecord), true
	}

	v.registerRule(rule)
	return v
}

func (v *FieldValidator) Within(vals ...int) *FieldValidator {
	rule := func(path path, data interface{}) (interface{}, MessageRecord, bool) {
		// JSON numbers decode as float64, so check numerics generically and
		// only compare integral values against the int set.
		if f, ok := toFloat(unwrapValue(data)); ok {
			num := int(f)
			if f != float64(num) || !slices.Contains(vals, num) {
				strVals := make([]string, 0, len(vals))
				for _, val := range vals {
					strVals = append(strVals, fmt.Sprintf("%d", val))
				}

				msg := fmt.Sprintf("%s may only contain %s", path.last(), strings.Join(strVals, ", "))
				mr := make(MessageRecord)
				mr.InsertMessage(path, msg)
				return data, mr, false
			}
		}

		return data, make(MessageRecord), true
	}

	v.registerRule(rule)
	return v
}

func (v *FieldValidator) WithinS(vals ...string) *FieldValidator {
	rule := func(path path, data interface{}) (interface{}, MessageRecord, bool) {
		if str, ok := unwrapValue(data).(string); ok {
			if !slices.Contains(vals, str) {
				msg := fmt.Sprintf("%s may only contain %s", path.last(), strings.Join(vals, ", "))
				mr := make(MessageRecord)
				mr.InsertMessage(path, msg)
				return data, mr, false
			}
		}

		return data, make(MessageRecord), true
	}

	v.registerRule(rule)
	return v
}

func (v *FieldValidator) Base64() *FieldValidator {
	rule := func(path path, data interface{}) (interface{}, MessageRecord, bool) {
		if data == nil {
			return data, make(MessageRecord), true
		}

		passes := true

		if str, ok := unwrapValue(data).(string); ok {
			_, err := base64.StdEncoding.DecodeString(str)
			if err != nil {
				passes = false

			}
		} else {
			passes = false
		}

		if !passes {
			msg := fmt.Sprintf("%s must be a base64 encoded string", path.last())
			mr := make(MessageRecord)
			mr.InsertMessage(path, msg)
			return data, mr, false
		}

		return data, make(MessageRecord), true
	}

	v.registerRule(rule)
	return v
}

func (v *FieldValidator) MinRune(n int) *FieldValidator {
	rule := func(path path, data interface{}) (interface{}, MessageRecord, bool) {
		if str, ok := unwrapValue(data).(string); ok {
			if utf8.RuneCountInString(str) < n {
				msg := fmt.Sprintf("%s must be at least %d characters long", path.last(), n)
				mr := make(MessageRecord)
				mr.InsertMessage(path, msg)
				return data, mr, false
			}
		}

		return data, make(MessageRecord), true
	}

	v.registerRule(rule)
	return v
}

func (v *FieldValidator) MaxRune(n int) *FieldValidator {
	rule := func(path path, data interface{}) (interface{}, MessageRecord, bool) {
		if str, ok := unwrapValue(data).(string); ok {
			if utf8.RuneCountInString(str) > n {
				msg := fmt.Sprintf("%s must be at most %d characters long", path.last(), n)
				mr := make(MessageRecord)
				mr.InsertMessage(path, msg)
				return data, mr, false
			}
		}

		return data, make(MessageRecord), true
	}

	v.registerRule(rule)
	return v
}

func (v *FieldValidator) UUID() *FieldValidator {
	rule := func(path path, data interface{}) (interface{}, MessageRecord, bool) {
		if data == nil {
			return data, make(MessageRecord), true
		}

		passes := true

		if str, ok := unwrapValue(data).(string); ok {
			_, err := uuid.Parse(str)
			if err != nil {
				passes = false
			}
		} else {
			passes = false
		}

		if !passes {
			msg := fmt.Sprintf("%s must be a valid UUID", path.last())
			mr := make(MessageRecord)
			mr.InsertMessage(path, msg)
			return data, mr, false
		}

		return data, make(MessageRecord), true
	}

	v.registerRule(rule)
	return v
}

func unwrapValue(value interface{}) interface{} {
	val := reflect.ValueOf(value)
	if val.Kind() == reflect.Ptr {
		// Comparison between nils sometimes does not match
		// because of interface. Here we generalize it to
		// single nil to make sure the comparison matches.
		//
		// @see: https://glucn.medium.com/golang-an-interface-holding-a-nil-value-is-not-nil-bb151f472cc7
		if val.IsNil() {
			return nil
		}

		return val.Elem().Interface()
	}

	return value
}
