import type { ISO8601DateString } from '@/types/time'

export interface OrganizationInvitation {
  id: string
  organization_id: string
  email: string
  role: string
  status: 'pending' | 'accepted' | 'rejected' | 'revoked' | 'expired' | string
  token: string
  invited_by: string
  expires_at: ISO8601DateString
  created_at: ISO8601DateString
  updated_at: ISO8601DateString
}
