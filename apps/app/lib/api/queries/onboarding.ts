import { mutationOptions } from '@tanstack/react-query'

import { OnboardingSurveyDto } from '../dtos/onboarding/schema'
import { services } from '../services'

const submitSurvey = () => {
  return mutationOptions({
    mutationFn: async (reqBody: OnboardingSurveyDto) => {
      const res = await services.onboarding.submitSurvey(reqBody)
      return res.data
    },
  })
}

export const onboardingQueries = {
  submitSurvey,
} as const
