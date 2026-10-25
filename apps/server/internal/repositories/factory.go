package repositories

import (
	"database/sql"

	"cloudrive/server/internal/config"
	"cloudrive/server/internal/lib/secretbox"
)

type Repositories struct {
	Provider               ProviderRepository
	User                   UserRepository
	Organization           OrganizationRepository
	OrganizationMember     OrganizationMemberRepository
	Workspace              WorkspaceRepository
	WorkspaceMember        WorkspaceMemberRepository
	OrganizationInvitation OrganizationInvitationRepository
	StorageAccount         StorageAccountRepository
	S3Credential           S3CredentialRepository
	S3Bucket               S3BucketRepository
	OnboardingSurvey       OnboardingSurveyRepository
}

func New(cfg config.ConfigApp, db *sql.DB, box *secretbox.SecretBox) Repositories {
	base := BaseRepository{cfg: &cfg, DB: db}

	return Repositories{
		Provider:               ProviderRepository{BaseRepository: base},
		User:                   UserRepository{BaseRepository: base},
		Organization:           OrganizationRepository{BaseRepository: base},
		OrganizationMember:     OrganizationMemberRepository{BaseRepository: base},
		Workspace:              WorkspaceRepository{BaseRepository: base},
		WorkspaceMember:        WorkspaceMemberRepository{BaseRepository: base},
		OrganizationInvitation: OrganizationInvitationRepository{BaseRepository: base},
		StorageAccount:         StorageAccountRepository{BaseRepository: base, Box: box},
		S3Credential:           S3CredentialRepository{BaseRepository: base, Box: box},
		S3Bucket:               S3BucketRepository{BaseRepository: base},
		OnboardingSurvey:       OnboardingSurveyRepository{BaseRepository: base},
	}
}
