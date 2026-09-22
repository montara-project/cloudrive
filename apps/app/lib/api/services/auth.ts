import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { AuthResources } from './types/auth'

import { ClientFetchApi } from '../client-fetch'

const path = `/v1/auth`

const api = new ClientFetchApi({
  baseURL: String(env.NEXT_PUBLIC_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

const resources = (): AuthResources => {
  return {
    signIn: (reqBody) => {
      return api.post(`${path}/email-password/sign-in`, reqBody)
    },
    signUp: (reqBody) => {
      return api.post(`${path}/email-password/sign-up`, reqBody)
    },
    magicLinkSignIn: (reqBody) => {
      return api.post(`${path}/magic-link/sign-in`, reqBody)
    },
    magicLinkExchange: (reqBody) => {
      return api.post(`${path}/magic-link/exchange`, reqBody)
    },
    profile: () => {
      return api.get(`/v1/me`)
    },
    refresh: (reqBody) => {
      return api.post(`${path}/token/refresh`, reqBody)
    },
    signOut: () => {
      return api.post(`${path}/sign-out`)
    },
  }
}

export const authServices = resources()
