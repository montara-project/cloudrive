import type { ApiListResponse } from '@/types/api'

import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { Models } from '../models'

import { ClientFetchApi } from '../client-fetch'

const api = new ClientFetchApi({
  baseURL: String(env.NEXT_PUBLIC_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

export const providerServices = {
  list: (params?: Record<string, unknown>) =>
    api.get<ApiListResponse<Models.Provider>>('/v1/providers', { params }),
} as const
