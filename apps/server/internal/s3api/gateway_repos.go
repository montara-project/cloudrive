package s3api

import (
	"database/sql"

	"cloudrive/server/internal/models"
	"cloudrive/server/internal/repositories"

	"github.com/google/uuid"
)

// RepoAdapter adapts the concrete repositories to the gateway's Repos
// interface, including the decrypted-credentials path.
type RepoAdapter struct {
	DB             *sql.DB
	S3Credentials  S3CredentialRepo
	S3Buckets      S3BucketRepo
	StorageAccount StorageAccountRepo
}

// S3CredentialRepo is the credential repository surface the gateway uses.
type S3CredentialRepo interface {
	GetActiveByAccessKeyID(accessKeyID string) (*models.S3Credential, error)
	SecretKey(id uuid.UUID) ([]byte, error)
	TouchLastUsed(id uuid.UUID) error
}

// S3BucketRepo is the bucket mapping repository surface the gateway uses.
type S3BucketRepo interface {
	GetByName(name string) (*models.S3Bucket, error)
	ListByWorkspace(workspaceID uuid.UUID, opts *repositories.QueryOptions) ([]*models.S3Bucket, repositories.PaginationMetadata, error)
}

// StorageAccountRepo resolves the backing account plus its provider catalog
// row for connector construction.
type StorageAccountRepo interface {
	GetWithProvider(id uuid.UUID) (*models.StorageAccount, *models.Provider, error)
	Credentials(id uuid.UUID) ([]byte, error)
}

func (a RepoAdapter) S3CredentialByAccessKey(accessKeyID string) (*models.S3Credential, []byte, error) {
	credential, err := a.S3Credentials.GetActiveByAccessKeyID(accessKeyID)
	if err != nil {
		return nil, nil, err
	}

	secret, err := a.S3Credentials.SecretKey(credential.ID)
	if err != nil {
		return nil, nil, err
	}

	return credential, secret, nil
}

func (a RepoAdapter) S3CredentialTouch(id uuid.UUID) {
	_ = a.S3Credentials.TouchLastUsed(id)
}

func (a RepoAdapter) BucketByName(name string) (*models.S3Bucket, error) {
	return a.S3Buckets.GetByName(name)
}

// BucketsByWorkspace lists the bucket mappings of one workspace.
func (a RepoAdapter) BucketsByWorkspace(workspaceID uuid.UUID) ([]*models.S3Bucket, error) {
	buckets, _, err := a.S3Buckets.ListByWorkspace(workspaceID, &repositories.QueryOptions{})
	return buckets, err
}

func (a RepoAdapter) StorageAccountWithProvider(id uuid.UUID) (*models.StorageAccount, *models.Provider, string, error) {
	account, provider, err := a.StorageAccount.GetWithProvider(id)
	if err != nil {
		return nil, nil, "", err
	}

	credsJSON, err := a.StorageAccount.Credentials(id)
	if err != nil {
		return nil, nil, "", err
	}

	return account, provider, string(credsJSON), nil
}
