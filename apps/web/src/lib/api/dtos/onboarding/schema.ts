import z from 'zod'

// Must stay in sync with the server: `dtos.ReferralSources` / `dtos.UseCases`
// and the CHECK constraint on `onboarding_surveys` (migration 000006).
export const REFERRAL_SOURCES = [
  'search_engine',
  'social_media',
  'recommendation',
  'community',
  'github',
  'other',
] as const

export const USE_CASES = [
  'personal_backup',
  'team_collaboration',
  's3_api_integration',
  'media_archive',
  'development',
  'other',
] as const

export type ReferralSource = (typeof REFERRAL_SOURCES)[number]
export type UseCase = (typeof USE_CASES)[number]

const detail = z.string().trim().max(255, 'Use at most 255 characters')

export const ReferralStepSchema = z.object({
  referral_source: z.enum(REFERRAL_SOURCES, { error: 'Pick an option' }),
  referral_source_detail: detail,
})

export const UseCasesStepSchema = z.object({
  use_cases: z.array(z.enum(USE_CASES)).min(1, 'Pick at least one option'),
  use_case_detail: detail,
})

export const OnboardingSurveySchema = z.object({
  ...ReferralStepSchema.shape,
  ...UseCasesStepSchema.shape,
})

export type ReferralStepDto = z.infer<typeof ReferralStepSchema>
export type UseCasesStepDto = z.infer<typeof UseCasesStepSchema>
export type OnboardingSurveyDto = z.infer<typeof OnboardingSurveySchema>
