import type { ISO8601DateString } from '@/types/time'

export interface Workspace {
  id: string
  organization_id: string
  name: string
  slug: string
  description?: string
  created_by: string
  deleted_at?: ISO8601DateString | null
  created_at: ISO8601DateString
  updated_at: ISO8601DateString
}
