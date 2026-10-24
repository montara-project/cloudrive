import { env } from '@/config/env'

import type { WaitlistDto } from '../dtos/waitlist/schema'
import type { Models } from '../models'

import { ClientFetchApi } from '../client-fetch'

// Public endpoint: no storageKey, so no bearer token is attached.
const api = new ClientFetchApi({ baseURL: String(env.VITE_API_URL) }).default

export const waitlistServices = {
  join: (data: WaitlistDto) => api.post<Models.WaitlistEntry>('/api/v1/waitlist', data),
} as const
