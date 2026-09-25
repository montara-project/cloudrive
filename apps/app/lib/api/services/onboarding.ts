import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import { ClientFetchApi } from '../client-fetch'
import { OnboardingResources } from './types/onboarding'

const api = new ClientFetchApi({
  baseURL: String(env.NEXT_PUBLIC_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

const onboardingResources = (): OnboardingResources => {
  return {
    submitSurvey: (reqBody) => {
      return api.post(`/v1/onboarding/survey`, reqBody)
    },
  }
}

export const onboardingServices = {
  ...onboardingResources(),
}
