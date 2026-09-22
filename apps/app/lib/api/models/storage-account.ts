import type { ISO8601DateString } from '@/types/time'

export type StorageAccountStatus =
  | 'pending_auth'
  | 'active'
  | 'expired'
  | 'revoked'
  | 'error'
  | string

export interface StorageAccount {
  id: string
  organization_id: string
  workspace_id: string
  provider_id: string
  owner_user_id: string
  display_name: string
  account_email?: string
  external_account_id: string
  settings?: Record<string, unknown>
  status: StorageAccountStatus
  last_synced_at?: ISO8601DateString | null
  deleted_at?: ISO8601DateString | null
  created_at: ISO8601DateString
  updated_at: ISO8601DateString
}
