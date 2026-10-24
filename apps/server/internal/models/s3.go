package models

import (
	"time"

	"github.com/google/uuid"
)

// S3Credential is a SigV4 access key issued by Cloudrive for its S3-compatible
// gateway. It belongs to a workspace and is bound to the user who created it.
// The secret part is never stored in plaintext: it is encrypted into
// secret_key_encrypted and only decrypted in memory to verify signatures.
type S3Credential struct {
	ID                 uuid.UUID  `db:"id" json:"id"`
	OrganizationID     uuid.UUID  `db:"organization_id" json:"organization_id"`
	WorkspaceID        uuid.UUID  `db:"workspace_id" json:"workspace_id"`
	UserID             uuid.UUID  `db:"user_id" json:"user_id"`
	AccessKeyID        string     `db:"access_key_id" json:"access_key_id"`
	SecretKeyEncrypted string     `db:"secret_key_encrypted" json:"-"`
	KeyID              string     `db:"key_id" json:"-"`
	Label              *string    `db:"label" json:"label,omitempty"`
	Status             string     `db:"status" json:"status"`
	LastUsedAt         *time.Time `db:"last_used_at" json:"last_used_at,omitempty"`
	CreatedAt          time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt          time.Time  `db:"updated_at" json:"updated_at"`
}

// S3Bucket maps an S3 bucket name (global namespace) to one connected storage
// account and a root prefix inside it. Objects written through the gateway to
// this bucket live under the prefix in the backing account.
type S3Bucket struct {
	ID               uuid.UUID `db:"id" json:"id"`
	OrganizationID   uuid.UUID `db:"organization_id" json:"organization_id"`
	WorkspaceID      uuid.UUID `db:"workspace_id" json:"workspace_id"`
	Name             string    `db:"name" json:"name"`
	StorageAccountID uuid.UUID `db:"storage_account_id" json:"storage_account_id"`
	RootPrefix       string    `db:"root_prefix" json:"root_prefix"`
	CreatedBy        uuid.UUID `db:"created_by" json:"created_by"`
	CreatedAt        time.Time `db:"created_at" json:"created_at"`
	UpdatedAt        time.Time `db:"updated_at" json:"updated_at"`
}
