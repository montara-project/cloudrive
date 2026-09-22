import type { ISO8601DateString } from '@/types/time'

export interface OrganizationMember {
  id: string
  organization_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member' | string
  created_at: ISO8601DateString
  updated_at: ISO8601DateString
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  organization_id: string
  user_id: string
  role: 'admin' | 'member' | 'viewer' | string
  created_at: ISO8601DateString
  updated_at: ISO8601DateString
}
