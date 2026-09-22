import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { DEFAULT_PAGINATE } from '@/lib/constants/paginate'
import { getQueryClient } from '@/lib/providers/react-query'

import { PaginateDto } from '../dtos/paginate'
import { CreateWorkspaceDto, UpdateWorkspaceDto } from '../dtos/workspace/schema'
import { services } from '../services'
import { GetBaseParams } from './types/param'

export const LIST_WORKSPACE_QUERY_KEY = (orgId: string, params?: PaginateDto) => {
  return ['workspaces', orgId, params]
}

export const GET_WORKSPACE_QUERY_KEY = (id: string) => {
  return ['workspaces/id', id]
}

const list = (orgId: string, params?: PaginateDto) =>
  queryOptions({
    queryKey: LIST_WORKSPACE_QUERY_KEY(orgId, params),
    queryFn: async () => {
      const pagination = {
        offset: params?.offset ?? DEFAULT_PAGINATE.offset,
        limit: params?.limit ?? DEFAULT_PAGINATE.limit,
        order_by: params?.order_by,
        order: params?.order,
      }

      const res = await services.workspaces.list(orgId, pagination)
      return res.data
    },
    enabled: !!orgId,
  })

const get = (params: GetBaseParams) =>
  queryOptions({
    queryKey: GET_WORKSPACE_QUERY_KEY(params.id),
    queryFn: async () => {
      const res = await services.workspaces.get(params.id)
      return res.data
    },
  })

const create = (orgId: string) =>
  mutationOptions({
    mutationFn: async (reqBody: CreateWorkspaceDto) => {
      const res = await services.workspaces.create(orgId, reqBody)
      return res.data
    },
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: ['workspaces', orgId] })
    },
  })

const update = (wsId: string) =>
  mutationOptions({
    mutationFn: async (reqBody: UpdateWorkspaceDto) => {
      const res = await services.workspaces.update(wsId, reqBody)
      return res.data
    },
    onSuccess: () => {
      const qc = getQueryClient()
      qc.invalidateQueries({ queryKey: ['workspaces'] })
      qc.invalidateQueries({ queryKey: GET_WORKSPACE_QUERY_KEY(wsId) })
    },
  })

const del = () =>
  mutationOptions({
    mutationFn: async (wsId: string) => {
      const res = await services.workspaces.delete(wsId)
      return res.data
    },
    onSuccess: (_, wsId) => {
      const qc = getQueryClient()
      qc.invalidateQueries({ queryKey: ['workspaces'] })
      qc.invalidateQueries({ queryKey: GET_WORKSPACE_QUERY_KEY(wsId) })
    },
  })

export const workspaceQueries = {
  list,
  get,
  create,
  update,
  delete: del,
} as const
