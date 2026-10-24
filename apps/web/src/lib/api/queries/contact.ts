import { mutationOptions } from '@tanstack/react-query'

import type { ContactDto } from '../dtos/contact/schema'

import { services } from '../services'

const send = () =>
  mutationOptions({
    mutationFn: async (reqBody: ContactDto) => {
      const res = await services.contact.send(reqBody)
      return res.data
    },
  })

export const contactQueries = { send } as const
