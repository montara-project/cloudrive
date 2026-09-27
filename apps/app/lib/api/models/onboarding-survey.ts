import type { ISO8601DateString } from '@/types/time'

export interface OnboardingSurvey {
  id: string
  user_id: string
  referral_source: string
  referral_source_detail?: string
  use_cases: string[]
  use_case_detail?: string
  created_at: ISO8601DateString
  updated_at: ISO8601DateString
}
