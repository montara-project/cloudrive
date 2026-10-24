package repositories

import "cloudrive/server/internal/lib/apperr"

// Repository errors are typed application errors, so handlers return them
// unchanged and the ErrorHandler answers with their status and message.
var (
	ErrInsertDuplicate = apperr.New(apperr.KindConflict, "Resource already exists")
	ErrEditConflict    = apperr.New(apperr.KindConflict, "Resource changed or does not exist")
	ErrRecordNotFound  = apperr.New(apperr.KindNotFound, "Resource not found")
)
