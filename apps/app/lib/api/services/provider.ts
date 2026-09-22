import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import { ClientFetchApi } from '../client-fetch'
import { ProviderResources } from './types/provider'

const api = new ClientFetchApi({
  baseURL: String(env.NEXT_PUBLIC_API_URL),
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
