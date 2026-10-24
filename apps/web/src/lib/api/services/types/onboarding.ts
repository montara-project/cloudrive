import type { AxiosItemResponse } from '@/types/api'

import type { OnboardingSurveyDto } from '../../dtos/onboarding/schema'
import type { Models } from '../../models'

export type OnboardingResources = {
  submitSurvey: (
    reqBody: OnboardingSurveyDto
  ) => Promise<AxiosItemResponse<Models.OnboardingSurvey>>
}
