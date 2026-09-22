import z from 'zod'

import { requiredEmail, requiredString } from '@/lib/validation'

const slug = requiredString('slug').regex(
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  'Use lowercase letters, numbers and dashes only'
)

export const CreateOrganizationSchema = z.object({
  name: requiredString('name'),
  slug,
  // Optional fields stay plain strings ('' = unset) so the schema's input
  // type matches the form's defaultValues.
  logo: z.string(),
})

export const UpdateOrganizationSchema = z.object({
  name: requiredString('name'),
  logo: z.string(),
})

export const AddMemberSchema = z.object({
  user_id: requiredString('user id'),
  role: requiredString('role'),
})

export const CreateInvitationSchema = z.object({
  email: requiredEmail('email'),
  role: z.enum(['admin', 'member']),
})

export type CreateOrganizationDto = z.infer<typeof CreateOrganizationSchema>
export type UpdateOrganizationDto = z.infer<typeof UpdateOrganizationSchema>
export type AddMemberDto = z.infer<typeof AddMemberSchema>
export type CreateInvitationDto = z.infer<typeof CreateInvitationSchema>
