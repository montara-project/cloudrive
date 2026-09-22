import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { DEFAULT_PAGINATE } from '@/lib/constants/paginate'
import { getQueryClient } from '@/lib/providers/react-query'

import { PaginateDto } from '../dtos/paginate'
import { services } from '../services'

export const LIST_WORKSPACE_MEMBER_QUERY_KEY = (wsId: string, params?: PaginateDto) => {
  return ['workspaces/members', wsId, params]
}

export const GET_WORKSPACE_MEMBER_QUERY_KEY = (wsId: string, userId: string) => {
  return ['workspaces/members/id', wsId, userId]
}

const list = (wsId: string, params?: PaginateDto) =>
  queryOptions({
    queryKey: LIST_WORKSPACE_MEMBER_QUERY_KEY(wsId, params),
    queryFn: async () => {
      const pagination = {
        offset: params?.offset ?? DEFAULT_PAGINATE.offset,
        limit: params?.limit ?? DEFAULT_PAGINATE.limit,
        order_by: params?.order_by,
        order: params?.order,
      }

      const res = await services.workspaces.members.list(wsId, pagination)
      return res.data
    },
    enabled: !!wsId,
  })

const add = (wsId: string) =>
  mutationOptions({
    mutationFn: async (reqBody: { user_id: string; role: string }) => {
      const res = await services.workspaces.members.add(wsId, reqBody)
      return res.data
    },
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: ['workspaces/members', wsId] })
    },
  })

const update = (wsId: string) =>
  mutationOptions({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const res = await services.workspaces.members.update(wsId, userId, { role })
      return res.data
    },
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: ['workspaces/members', wsId] })
    },
  })

const remove = (wsId: string) =>
  mutationOptions({
    mutationFn: async (userId: string) => {
      const res = await services.workspaces.members.remove(wsId, userId)
      return res.data
    },
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: ['workspaces/members', wsId] })
    },
  })

export const workspaceMemberQueries = {
  list,
  add,
  update,
  remove,
} as const
