import { mutationOptions } from '@tanstack/react-query'

import type { WaitlistDto } from '../dtos/waitlist/schema'

import { services } from '../services'

const join = () =>
  mutationOptions({
    mutationFn: async (reqBody: WaitlistDto) => {
      const res = await services.waitlist.join(reqBody)
      return res.data
    },
  })

export const waitlistQueries = { join } as const
