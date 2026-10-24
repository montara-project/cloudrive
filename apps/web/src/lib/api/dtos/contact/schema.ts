import { z } from 'zod'

import { EMAIL_MESSAGE, EMAIL_PATTERN } from '../email'

export const contactSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name.'),
  email: z.string().trim().regex(EMAIL_PATTERN, EMAIL_MESSAGE),
  topic: z.string(),
  message: z.string().trim().min(10, 'Please tell us a little more (at least 10 characters).'),
})

export type ContactDto = z.infer<typeof contactSchema>
