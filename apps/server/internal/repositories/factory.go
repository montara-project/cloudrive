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

func New(db *sql.DB, cfg *config.ConfigApp, box *secretbox.SecretBox) Repositories {
	return Repositories{
		Provider: ProviderRepository{BaseRepository: BaseRepository{
			DB:         db,
			TableName:  "providers",
			SoftDelete: true,
		}},
		User: UserRepository{BaseRepository: BaseRepository{
			DB:        db,
			TableName: "users",
		}},
		Organization: OrganizationRepository{BaseRepository: BaseRepository{
			DB:         db,
			TableName:  "organizations",
			SoftDelete: true,
		}},
		OrganizationMember: OrganizationMemberRepository{BaseRepository: BaseRepository{
			DB:        db,
			TableName: "organization_members",
		}},
		Workspace: WorkspaceRepository{BaseRepository: BaseRepository{
			DB:         db,
			TableName:  "workspaces",
			SoftDelete: true,
		}},
		WorkspaceMember: WorkspaceMemberRepository{BaseRepository: BaseRepository{
			DB:        db,
			TableName: "workspace_members",
		}},
		OrganizationInvitation: OrganizationInvitationRepository{BaseRepository: BaseRepository{
			DB:        db,
			TableName: "organization_invitations",
		}},
		StorageAccount: StorageAccountRepository{BaseRepository: BaseRepository{
			DB:         db,
			TableName:  "storage_accounts",
			SoftDelete: true,
		}, Box: box},
		S3Credential: S3CredentialRepository{BaseRepository: BaseRepository{
			DB:        db,
			TableName: "s3_credentials",
		}, Box: box},
		S3Bucket: S3BucketRepository{BaseRepository: BaseRepository{
			DB:        db,
			TableName: "s3_buckets",
		}},
		OnboardingSurvey: OnboardingSurveyRepository{BaseRepository: BaseRepository{
			DB:        db,
			TableName: "onboarding_surveys",
		}},
	}
}
