package dtos

import (
	"time"

	"github.com/google/uuid"
)

type CreateS3CredentialRequest struct {
	Label string `json:"label"`
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
