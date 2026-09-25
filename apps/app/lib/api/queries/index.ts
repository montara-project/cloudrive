import { onboardingQueries } from './onboarding'
import { organizationQueries } from './organization'
import { organizationInvitationQueries } from './organization_invitation'
import { organizationMemberQueries } from './organization_member'
import { providerQueries } from './provider'
import { s3BucketQueries } from './s3_bucket'
import { s3CredentialQueries } from './s3_credential'
import { storageAccountQueries } from './storage_account'
import { workspaceQueries } from './workspace'
import { workspaceMemberQueries } from './workspace_member'

export const queries = {
  organizations: {
    ...organizationQueries,
    members: organizationMemberQueries,
    invitations: organizationInvitationQueries,
  },
  workspaces: {
    ...workspaceQueries,
    members: workspaceMemberQueries,
  },
  providers: providerQueries,
  storageAccounts: storageAccountQueries,
  s3: {
    credentials: s3CredentialQueries,
    buckets: s3BucketQueries,
  },
  onboarding: onboardingQueries,
}
