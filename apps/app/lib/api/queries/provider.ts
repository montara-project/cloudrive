import { queryOptions } from '@tanstack/react-query'

import { DEFAULT_PAGINATE } from '@/lib/constants/paginate'

import { PaginateDto } from '../dtos/paginate'
import { services } from '../services'

export const LIST_PROVIDER_QUERY_KEY = (params?: PaginateDto) => {
  return ['providers', params]
}

const list = (params?: PaginateDto) =>
  queryOptions({
    queryKey: LIST_PROVIDER_QUERY_KEY(params),
    queryFn: async () => {
      const pagination = {
        offset: params?.offset ?? DEFAULT_PAGINATE.offset,
        limit: params?.limit ?? DEFAULT_PAGINATE.limit,
        order_by: params?.order_by,
        order: params?.order,
      }

      const res = await services.provider.list(pagination)
      return res.data
    },
    staleTime: 5 * 60 * 1000,
  })

export const providerQueries = {
  list,
} as const
