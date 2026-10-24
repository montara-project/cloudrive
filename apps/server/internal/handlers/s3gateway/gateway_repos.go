package s3gateway

import (
	"context"

	"cloudrive/server/internal/models"
	"cloudrive/server/internal/repositories"

	"github.com/google/uuid"
)

// RepoAdapter adapts the concrete repositories to the gateway's Repos
// interface, including the decrypted-credentials path.
type RepoAdapter struct {
	S3Credentials  S3CredentialRepo
	S3Buckets      S3BucketRepo
	StorageAccount StorageAccountRepo
}

// S3CredentialRepo is the credential repository surface the gateway uses.
type S3CredentialRepo interface {
	GetActiveByAccessKeyID(ctx context.Context, accessKeyID string) (models.S3Credential, error)
	SecretKey(ctx context.Context, id uuid.UUID) ([]byte, error)
	TouchLastUsed(ctx context.Context, id uuid.UUID) error
}

// S3BucketRepo is the bucket mapping repository surface the gateway uses.
type S3BucketRepo interface {
	GetByName(ctx context.Context, name string) (models.S3Bucket, error)
	ListByWorkspace(ctx context.Context, workspaceID uuid.UUID, p repositories.ListParams) ([]models.S3Bucket, error)
}

// StorageAccountRepo resolves the backing account plus its provider catalog
// row for connector construction.
type StorageAccountRepo interface {
	GetWithProvider(ctx context.Context, id uuid.UUID) (models.StorageAccount, models.Provider, error)
	Credentials(ctx context.Context, id uuid.UUID) ([]byte, error)
}

func (a RepoAdapter) S3CredentialByAccessKey(ctx context.Context, accessKeyID string) (*models.S3Credential, []byte, error) {
	credential, err := a.S3Credentials.GetActiveByAccessKeyID(ctx, accessKeyID)
	if err != nil {
		return nil, nil, err
	}

	secret, err := a.S3Credentials.SecretKey(ctx, credential.ID)
	if err != nil {
		return nil, nil, err
	}

	return &credential, secret, nil
}

func (a RepoAdapter) S3CredentialTouch(ctx context.Context, id uuid.UUID) {
	_ = a.S3Credentials.TouchLastUsed(ctx, id)
}

func (a RepoAdapter) BucketByName(ctx context.Context, name string) (*models.S3Bucket, error) {
	bucket, err := a.S3Buckets.GetByName(ctx, name)
	if err != nil {
		return nil, err
	}
	return &bucket, nil
}

// BucketsByWorkspace lists the bucket mappings of one workspace.
func (a RepoAdapter) BucketsByWorkspace(ctx context.Context, workspaceID uuid.UUID) ([]*models.S3Bucket, error) {
	buckets, err := a.S3Buckets.ListByWorkspace(ctx, workspaceID, repositories.ListParams{Limit: 100})
	if err != nil {
		return nil, err
	}

	out := make([]*models.S3Bucket, 0, len(buckets))
	for i := range buckets {
		out = append(out, &buckets[i])
	}
	return out, nil
}

func (a RepoAdapter) StorageAccountWithProvider(ctx context.Context, id uuid.UUID) (*models.StorageAccount, *models.Provider, string, error) {
	account, provider, err := a.StorageAccount.GetWithProvider(ctx, id)
	if err != nil {
		return nil, nil, "", err
	}

	credsJSON, err := a.StorageAccount.Credentials(ctx, id)
	if err != nil {
		return nil, nil, "", err
	}

	return &account, &provider, string(credsJSON), nil
}
