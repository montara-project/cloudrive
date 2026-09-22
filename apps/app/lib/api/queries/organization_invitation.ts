import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { DEFAULT_PAGINATE } from '@/lib/constants/paginate'
import { getQueryClient } from '@/lib/providers/react-query'

import { CreateInvitationDto } from '../dtos/organization/schema'
import { PaginateDto } from '../dtos/paginate'
import { services } from '../services'

export const LIST_ORGANIZATION_INVITATION_QUERY_KEY = (orgId: string, params?: PaginateDto) => {
  return ['organizations/invitations', orgId, params]
}

const list = (orgId: string, params?: PaginateDto) =>
  queryOptions({
    queryKey: LIST_ORGANIZATION_INVITATION_QUERY_KEY(orgId, params),
    queryFn: async () => {
      const pagination = {
        offset: params?.offset ?? DEFAULT_PAGINATE.offset,
        limit: params?.limit ?? DEFAULT_PAGINATE.limit,
        order_by: params?.order_by,
        order: params?.order,
      }

      const res = await services.organization.invitations.list(orgId, pagination)
      return res.data
    },
    enabled: !!orgId,
  })

const create = (orgId: string) =>
  mutationOptions({
    mutationFn: async (reqBody: CreateInvitationDto) => {
      const res = await services.organization.invitations.create(orgId, reqBody)
      return res.data
    },
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: ['organizations/invitations', orgId] })
    },
  })

const update = (orgId: string) =>
  mutationOptions({
    mutationFn: async ({ invitationId, status }: { invitationId: string; status: string }) => {
      const res = await services.organization.invitations.update(orgId, invitationId, { status })
      return res.data
    },
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: ['organizations/invitations', orgId] })
    },
  })

const del = (orgId: string) =>
  mutationOptions({
    mutationFn: async (invitationId: string) => {
      const res = await services.organization.invitations.delete(orgId, invitationId)
      return res.data
    },
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: ['organizations/invitations', orgId] })
    },
  })

export const organizationInvitationQueries = {
  list,
  create,
  update,
  delete: del,
} as const
