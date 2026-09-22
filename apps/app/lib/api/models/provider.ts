import type { ISO8601DateString } from '@/types/time'

export interface Provider {
  id: string
  slug: string
  name: string
  protocol: string
  auth_type: string
  capabilities?: Record<string, unknown>
  is_active: boolean
  deleted_at?: ISO8601DateString | null
  created_at: ISO8601DateString
  updated_at: ISO8601DateString
}
