import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { ProviderResources } from './types/provider'

import { ClientFetchApi } from '../client-fetch'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

const providerResources = (): ProviderResources => {
  return {
    list: (params) => {
      return api.get(`/v1/providers`, { params })
    },
  }
}

export const providerServices = {
  ...providerResources(),
}
