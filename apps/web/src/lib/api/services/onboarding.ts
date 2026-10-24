import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { OnboardingResources } from './types/onboarding'

import { ClientFetchApi } from '../client-fetch'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
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
