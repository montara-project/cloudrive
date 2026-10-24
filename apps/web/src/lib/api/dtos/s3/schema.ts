import z from 'zod'

import { requiredString } from '@/lib/validation'

// Mirrors the server's bucket naming rule (3-63 chars, lowercase, dots/dashes).
const bucketName = requiredString('bucket name').regex(
  /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/,
  '3-63 chars: lowercase letters, numbers, dots and dashes'
)

export const CreateS3CredentialSchema = z.object({
  label: z.string(),
})

export const CreateS3BucketSchema = z.object({
  name: bucketName,
  storage_account_id: requiredString('storage account'),
  root_prefix: z.string(),
})

export type CreateS3CredentialDto = z.infer<typeof CreateS3CredentialSchema>
export type CreateS3BucketDto = z.infer<typeof CreateS3BucketSchema>
