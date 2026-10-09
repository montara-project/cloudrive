import { AxiosItemResponse } from '@/types/api'

import { OnboardingSurveyDto } from '../../dtos/onboarding/schema'
import { Models } from '../../models'

export type OnboardingResources = {
  submitSurvey: (
    reqBody: OnboardingSurveyDto
  ) => Promise<AxiosItemResponse<Models.OnboardingSurvey>>
}
