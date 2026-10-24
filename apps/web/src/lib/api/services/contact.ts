import { env } from '@/config/env'

import type { ContactDto } from '../dtos/contact/schema'
import type { Models } from '../models'

import { ClientFetchApi } from '../client-fetch'

// Public endpoint: no storageKey, so no bearer token is attached.
const api = new ClientFetchApi({ baseURL: String(env.VITE_API_URL) }).default

export const contactServices = {
  send: (data: ContactDto) => api.post<Models.ContactTicket>('/v1/contact', data),
} as const
