package repositories

import (
	"database/sql"

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

func New(db *sql.DB, box *secretbox.SecretBox) Repositories {
	return Repositories{
		Provider:               ProviderRepository{BaseRepository: BaseRepository{DB: db}},
		User:                   UserRepository{BaseRepository: BaseRepository{DB: db}},
		Organization:           OrganizationRepository{BaseRepository: BaseRepository{DB: db}},
		OrganizationMember:     OrganizationMemberRepository{BaseRepository: BaseRepository{DB: db}},
		Workspace:              WorkspaceRepository{BaseRepository: BaseRepository{DB: db}},
		WorkspaceMember:        WorkspaceMemberRepository{BaseRepository: BaseRepository{DB: db}},
		OrganizationInvitation: OrganizationInvitationRepository{BaseRepository: BaseRepository{DB: db}},
		StorageAccount:         StorageAccountRepository{BaseRepository: BaseRepository{DB: db}, Box: box},
		S3Credential:           S3CredentialRepository{BaseRepository: BaseRepository{DB: db}, Box: box},
		S3Bucket:               S3BucketRepository{BaseRepository: BaseRepository{DB: db}},
		OnboardingSurvey:       OnboardingSurveyRepository{BaseRepository: BaseRepository{DB: db}},
	}
}
