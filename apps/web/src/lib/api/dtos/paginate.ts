import z from 'zod'

import { requiredNumber } from '@/lib/validation'

export const PaginateSchema = z.object({
  offset: requiredNumber('offset').optional(),
  limit: requiredNumber('limit').optional(),
  order_by: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
})

export type PaginateDto = z.infer<typeof PaginateSchema>
