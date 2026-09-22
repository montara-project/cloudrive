export namespace Models {
  export type User = import('./user').User
  export type Organization = import('./organization').Organization
  export type Workspace = import('./workspace').Workspace
  export type OrganizationMember = import('./member').OrganizationMember
  export type WorkspaceMember = import('./member').WorkspaceMember
  export type OrganizationInvitation = import('./invitation').OrganizationInvitation
  export type StorageAccount = import('./storage-account').StorageAccount
  export type Provider = import('./provider').Provider
  export type S3Credential = import('./s3').S3Credential
  export type S3Bucket = import('./s3').S3Bucket
}
