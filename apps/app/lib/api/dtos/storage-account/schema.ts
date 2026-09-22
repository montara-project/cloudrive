import z from 'zod'

import { requiredString } from '@/lib/validation'

const jsonObject = (attribute: string, optional = false) => {
  const base = z
    .string()
    .refine((value) => {
      if (!value.trim()) return optional
      try {
        const parsed = JSON.parse(value)
        return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      } catch {
        return false
      }
    }, `${attribute} must be a valid JSON object`)
    .transform((value) => (value.trim() ? JSON.parse(value) : undefined))

  return optional ? base.optional() : base
}

export const ConnectStorageAccountSchema = z.object({
  workspace_id: requiredString('workspace'),
  provider_id: requiredString('provider'),
  display_name: requiredString('display name'),
  account_email: z.string().optional(),
  external_account_id: requiredString('external account id'),
  credentials: jsonObject('credentials'),
  settings: jsonObject('settings', true),
})

export const UpdateStorageAccountSchema = z.object({
  display_name: requiredString('display name'),
  status: z.enum(['pending_auth', 'active', 'expired', 'revoked', 'error']),
})

export type ConnectStorageAccountDto = z.infer<typeof ConnectStorageAccountSchema>
export type UpdateStorageAccountDto = z.infer<typeof UpdateStorageAccountSchema>
