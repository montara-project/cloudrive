import { z } from 'zod'

import { EMAIL_MESSAGE, EMAIL_PATTERN } from '../email'

export const waitlistSchema = z.object({
  email: z.string().trim().toLowerCase().regex(EMAIL_PATTERN, EMAIL_MESSAGE),
})

export type WaitlistDto = z.infer<typeof waitlistSchema>
