import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { DEFAULT_PAGINATE } from '@/lib/constants/paginate'
import { getQueryClient } from '@/lib/providers/react-query'

import { PaginateDto } from '../dtos/paginate'
import { services } from '../services'

export const LIST_S3_CREDENTIAL_QUERY_KEY = (wsId: string, params?: PaginateDto) => {
  return ['s3/credentials', wsId, params]
}

const list = (wsId: string, params?: PaginateDto) =>
  queryOptions({
    queryKey: LIST_S3_CREDENTIAL_QUERY_KEY(wsId, params),
    queryFn: async () => {
      const pagination = {
        offset: params?.offset ?? DEFAULT_PAGINATE.offset,
        limit: params?.limit ?? DEFAULT_PAGINATE.limit,
        order_by: params?.order_by,
        order: params?.order,
      }

      const res = await services.s3.credentials.list(wsId, pagination)
      return res.data
    },
    enabled: !!wsId,
  })

const create = (wsId: string) =>
  mutationOptions({
    mutationFn: async (reqBody: { label?: string }) => {
      const res = await services.s3.credentials.create(wsId, reqBody)
      return res.data
    },
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: ['s3/credentials', wsId] })
    },
  })

const revoke = (wsId: string) =>
  mutationOptions({
    mutationFn: async (credentialId: string) => {
      const res = await services.s3.credentials.revoke(wsId, credentialId)
      return res.data
    },
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: ['s3/credentials', wsId] })
    },
  })

export const s3CredentialQueries = {
  list,
  create,
  revoke,
} as const
