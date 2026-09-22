import type { AxiosResponse } from 'axios'

import type { ApiListResponse } from '@/types/api'

import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { Models } from '../models'

import { ClientFetchApi } from '../client-fetch'

const api = new ClientFetchApi({
  baseURL: String(env.NEXT_PUBLIC_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

const base = '/v1/organizations'

export const organizationServices = {
  list: (params?: Record<string, unknown>) =>
    api.get<ApiListResponse<Models.Organization>>(base, { params }),

  create: (body: { name: string; slug: string; logo?: string }) =>
    api.post<Models.Organization>(base, body),

  get: (orgId: string) => api.get<Models.Organization>(`${base}/${orgId}`),

  update: (orgId: string, body: { name?: string; logo?: string }) =>
    api.patch<Models.Organization>(`${base}/${orgId}`, body),

  delete: (orgId: string) => api.delete(`${base}/${orgId}`),

  // Members
  listMembers: (orgId: string, params?: Record<string, unknown>) =>
    api.get<ApiListResponse<Models.OrganizationMember>>(`${base}/${orgId}/members`, { params }),

  addMember: (orgId: string, body: { user_id: string; role: string }) =>
    api.post<Models.OrganizationMember>(`${base}/${orgId}/members`, body),

  updateMemberRole: (orgId: string, userId: string, body: { role: string }) =>
    api.patch<Models.OrganizationMember>(`${base}/${orgId}/members/${userId}`, body),

  removeMember: (orgId: string, userId: string) => api.delete(`${base}/${orgId}/members/${userId}`),

  // Invitations
  listInvitations: (orgId: string, params?: Record<string, unknown>) =>
    api.get<ApiListResponse<Models.OrganizationInvitation>>(`${base}/${orgId}/invitations`, {
      params,
    }),

  createInvitation: (orgId: string, body: { email: string; role?: string }) =>
    api.post<Models.OrganizationInvitation>(`${base}/${orgId}/invitations`, body),

  updateInvitation: (orgId: string, invitationId: string, body: { status: string }) =>
    api.patch<Models.OrganizationInvitation>(`${base}/${orgId}/invitations/${invitationId}`, body),

  deleteInvitation: (orgId: string, invitationId: string) =>
    api.delete(`${base}/${orgId}/invitations/${invitationId}`),
} as const

export type OrganizationServices = typeof organizationServices
export type { AxiosResponse }
