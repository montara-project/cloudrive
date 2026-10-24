import type { WaitlistDto } from '../dtos/waitlist/schema'
import type { Models } from '../models'

import { api } from '../client-fetch'

const path = '/v1/waitlist'

export const waitlistServices = {
  join: (data: WaitlistDto) => api.post<Models.WaitlistEntry>(path, data),
} as const
