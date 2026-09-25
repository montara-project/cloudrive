import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { DEFAULT_PAGINATE } from '@/lib/constants/paginate'
import { getQueryClient } from '@/lib/providers/react-query'

import { CreateOrganizationDto, UpdateOrganizationDto } from '../dtos/organization/schema'
import { PaginateDto } from '../dtos/paginate'
import { services } from '../services'
import { GetBaseParams } from './types/param'

export const ORGANIZATION_QUERY_KEY = ['organizations']

export const LIST_ORGANIZATION_QUERY_KEY = (params?: PaginateDto) => {
  return ['organizations', params]
}

export const GET_ORGANIZATION_QUERY_KEY = (id: string) => {
  return ['organizations/id', id]
}

const list = (params?: PaginateDto) => {
  return queryOptions({
    queryKey: LIST_ORGANIZATION_QUERY_KEY(params),
    queryFn: async () => {
      const pagination = {
        offset: params?.offset ?? DEFAULT_PAGINATE.offset,
        limit: params?.limit ?? DEFAULT_PAGINATE.limit,
        order_by: params?.order_by,
        order: params?.order,
      }

      const res = await services.organization.list(pagination)
      return res.data
    },
  })
}

const get = (params: GetBaseParams) => {
  return queryOptions({
    queryKey: GET_ORGANIZATION_QUERY_KEY(params.id),
    queryFn: async () => {
      const res = await services.organization.get(params.id)
      return res.data
    },
  })
}

const create = (params?: PaginateDto) => {
  return mutationOptions({
    mutationFn: async (reqBody: CreateOrganizationDto) => {
      const res = await services.organization.create(reqBody)
      return res.data
    },
    onSuccess: () => {
      const qc = getQueryClient()
      qc.invalidateQueries({ queryKey: ORGANIZATION_QUERY_KEY })
      qc.invalidateQueries({ queryKey: LIST_ORGANIZATION_QUERY_KEY(params) })
    },
  })
}

const update = (orgId: string, params?: PaginateDto) => {
  return mutationOptions({
    mutationFn: async (reqBody: UpdateOrganizationDto) => {
      const res = await services.organization.update(orgId, reqBody)
      return res.data
    },
    onSuccess: () => {
      const qc = getQueryClient()
      qc.invalidateQueries({ queryKey: ORGANIZATION_QUERY_KEY })
      qc.invalidateQueries({ queryKey: LIST_ORGANIZATION_QUERY_KEY(params) })
      qc.invalidateQueries({ queryKey: GET_ORGANIZATION_QUERY_KEY(orgId) })
    },
  })
}

const del = (params?: PaginateDto) => {
  return mutationOptions({
    mutationFn: async (orgId: string) => {
      const res = await services.organization.delete(orgId)
      return res.data
    },
    onSuccess: (_, orgId) => {
      const qc = getQueryClient()
      qc.invalidateQueries({ queryKey: ORGANIZATION_QUERY_KEY })
      qc.invalidateQueries({ queryKey: LIST_ORGANIZATION_QUERY_KEY(params) })
      qc.invalidateQueries({ queryKey: GET_ORGANIZATION_QUERY_KEY(orgId) })
    },
  })
}

export const organizationQueries = {
  list,
  get,
  create,
  update,
  delete: del,
} as const
