import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { DEFAULT_PAGINATE } from '@/lib/constants/paginate'
import { getQueryClient } from '@/lib/providers/react-query'

import { AddMemberDto } from '../dtos/organization/schema'
import { PaginateDto } from '../dtos/paginate'
import { services } from '../services'

export const LIST_ORGANIZATION_MEMBER_QUERY_KEY = (orgId: string, params?: PaginateDto) => {
  return ['organizations/members', orgId, params]
}

export const GET_ORGANIZATION_MEMBER_QUERY_KEY = (orgId: string, userId: string) => {
  return ['organizations/members/id', orgId, userId]
}

const list = (orgId: string, params?: PaginateDto) =>
  queryOptions({
    queryKey: LIST_ORGANIZATION_MEMBER_QUERY_KEY(orgId, params),
    queryFn: async () => {
      const pagination = {
        offset: params?.offset ?? DEFAULT_PAGINATE.offset,
        limit: params?.limit ?? DEFAULT_PAGINATE.limit,
        order_by: params?.order_by,
        order: params?.order,
      }

      const res = await services.organization.members.list(orgId, pagination)
      return res.data
    },
    enabled: !!orgId,
  })

const add = (orgId: string) =>
  mutationOptions({
    mutationFn: async (reqBody: AddMemberDto) => {
      const res = await services.organization.members.add(orgId, reqBody)
      return res.data
    },
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: ['organizations/members', orgId] })
    },
  })

const update = (orgId: string) =>
  mutationOptions({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const res = await services.organization.members.update(orgId, userId, { role })
      return res.data
    },
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: ['organizations/members', orgId] })
    },
  })

const remove = (orgId: string) =>
  mutationOptions({
    mutationFn: async (userId: string) => {
      const res = await services.organization.members.remove(orgId, userId)
      return res.data
    },
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: ['organizations/members', orgId] })
    },
  })

export const organizationMemberQueries = {
  list,
  add,
  update,
  remove,
} as const
