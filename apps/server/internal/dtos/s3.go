package dtos

import (
	"regexp"
	"time"

	"cloudrive/server/internal/lib/validator"

	"github.com/google/uuid"
)

// bucketNamePattern mirrors the S3 bucket naming rules enforced by the
// database CHECK constraint (3-63 chars, lowercase, dots/dashes).
var bucketNamePattern = regexp.MustCompile(`^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$`)

type CreateS3CredentialRequest struct {
	Label string `json:"label"`
}

func (dto CreateS3CredentialRequest) Validate(v *validator.MapValidator) {
	v.Field("label").String()
}

type S3CredentialResponse struct {
	ID          uuid.UUID  `json:"id"`
	WorkspaceID uuid.UUID  `json:"workspace_id"`
	AccessKeyID string     `json:"access_key_id"`
	SecretKey   string     `json:"secret_key,omitempty"` // only on creation
	Label       *string    `json:"label,omitempty"`
	Status      string     `json:"status"`
	LastUsedAt  *time.Time `json:"last_used_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}

type CreateS3BucketRequest struct {
	Name             string `json:"name"`
	StorageAccountID string `json:"storage_account_id"`
	RootPrefix       string `json:"root_prefix"`
}

func (dto CreateS3BucketRequest) Validate(v *validator.MapValidator) {
	v.Field("name").Required().Match(bucketNamePattern)
	v.Field("storage_account_id").Required().UUID()
	v.Field("root_prefix").String()
}
