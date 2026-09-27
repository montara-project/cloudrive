import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { DEFAULT_PAGINATE } from '@/lib/constants/paginate'
import { getQueryClient } from '@/lib/providers/react-query'

import { PaginateDto } from '../dtos/paginate'
import { services } from '../services'

export const LIST_S3_BUCKET_QUERY_KEY = (wsId: string, params?: PaginateDto) => {
  return ['s3/buckets', wsId, params]
}

export const RECENT_S3_FILES_QUERY_KEY = (wsId: string, params?: PaginateDto) => {
  return ['s3/recent-files', wsId, params]
}

const list = (wsId: string, params?: PaginateDto) =>
  queryOptions({
    queryKey: LIST_S3_BUCKET_QUERY_KEY(wsId, params),
    queryFn: async () => {
      const pagination = {
        offset: params?.offset ?? DEFAULT_PAGINATE.offset,
        limit: params?.limit ?? DEFAULT_PAGINATE.limit,
        order_by: params?.order_by,
        order: params?.order,
      }

      const res = await services.s3.buckets.list(wsId, pagination)
      return res.data
    },
    enabled: !!wsId,
  })

// recentFiles powers the dashboard's "Recent files" section — it is a
// live provider aggregation (not a DB listing), so a short staleTime keeps
// revisits cheap without feeling stale.
const recentFiles = (wsId: string, params?: PaginateDto) =>
  queryOptions({
    queryKey: RECENT_S3_FILES_QUERY_KEY(wsId, params),
    queryFn: async () => {
      const res = await services.s3.buckets.recentFiles(wsId, {
        offset: 0,
        limit: params?.limit ?? 8,
      })
      return res.data
    },
    enabled: !!wsId,
    staleTime: 60 * 1000,
    retry: false,
  })

const create = (wsId: string) =>
  mutationOptions({
    mutationFn: async (reqBody: {
      name: string
      storage_account_id: string
      root_prefix?: string
    }) => {
      const res = await services.s3.buckets.create(wsId, reqBody)
      return res.data
    },
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: ['s3/buckets', wsId] })
      getQueryClient().invalidateQueries({ queryKey: ['s3/recent-files', wsId] })
    },
  })

const del = (wsId: string) =>
  mutationOptions({
    mutationFn: async (bucketId: string) => {
      const res = await services.s3.buckets.delete(wsId, bucketId)
      return res.data
    },
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: ['s3/buckets', wsId] })
      getQueryClient().invalidateQueries({ queryKey: ['s3/recent-files', wsId] })
    },
  })

export const s3BucketQueries = {
  list,
  recentFiles,
  create,
  delete: del,
} as const
