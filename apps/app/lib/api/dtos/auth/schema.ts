import z from 'zod'

import { requiredEmail, requiredString } from '@/lib/validation'

export const SignInSchema = z
  .object({
    email: requiredEmail('email'),
    password: requiredString('password'),
  })
  .required()

export const MagicLinkSchema = z
  .object({
    email: requiredEmail('email'),
  })
  .required()

export const RefreshSchema = z
  .object({
    refresh_token: requiredString('refresh_token'),
  })
  .required()

export type SignInDto = z.infer<typeof SignInSchema>
export type MagicLinkDto = z.infer<typeof MagicLinkSchema>
export type RefreshDto = z.infer<typeof RefreshSchema>
