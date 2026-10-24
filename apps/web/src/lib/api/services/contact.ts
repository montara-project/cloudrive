import type { ContactDto } from '../dtos/contact/schema'
import type { Models } from '../models'

import { api } from '../client-fetch'

const path = '/v1/contact'

export const contactServices = {
  send: (data: ContactDto) => api.post<Models.ContactTicket>(path, data),
} as const
