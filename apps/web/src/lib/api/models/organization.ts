import type { ISO8601DateString } from '@/types/time'

export interface Organization {
  id: string
  name: string
  slug: string
  logo?: string
  created_by: string
  deleted_at?: ISO8601DateString | null
  created_at: ISO8601DateString
  updated_at: ISO8601DateString
}
