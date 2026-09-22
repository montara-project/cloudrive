import type { ISO8601DateString } from '@/types/time'

// Mirrors dtos.S3CredentialResponse — secret_key is present only on creation.
export interface S3Credential {
  id: string
  workspace_id: string
  access_key_id: string
  secret_key?: string
  label?: string
  status: string
  last_used_at?: ISO8601DateString | null
  created_at: ISO8601DateString
}

export interface S3Bucket {
  id: string
  organization_id: string
  workspace_id: string
  name: string
  storage_account_id: string
  root_prefix: string
  created_by: string
  created_at: ISO8601DateString
  updated_at: ISO8601DateString
}
