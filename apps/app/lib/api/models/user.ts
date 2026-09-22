import type { ISO8601DateString } from '@/types/time'

export interface User {
  id: string
  email: string
  first_name: string
  last_name?: string
  image?: string
  role: string
  created_at: ISO8601DateString
  updated_at: ISO8601DateString
}
