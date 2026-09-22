import z from 'zod'

import { requiredString } from '@/lib/validation'

const slug = requiredString('slug').regex(
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  'Use lowercase letters, numbers and dashes only'
)

export const CreateWorkspaceSchema = z.object({
  name: requiredString('name'),
  slug,
  description: z.string(),
})

export const UpdateWorkspaceSchema = z.object({
  name: requiredString('name'),
  description: z.string(),
})

export type CreateWorkspaceDto = z.infer<typeof CreateWorkspaceSchema>
export type UpdateWorkspaceDto = z.infer<typeof UpdateWorkspaceSchema>
