import type { ApiListResponse } from '@/types/api'

import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { Models } from '../models'

import { ClientFetchApi } from '../client-fetch'

const api = new ClientFetchApi({
  baseURL: String(env.NEXT_PUBLIC_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

export const workspaceServices = {
  // Nested under the organization for create/list
  list: (orgId: string, params?: Record<string, unknown>) =>
    api.get<ApiListResponse<Models.Workspace>>(`/v1/organizations/${orgId}/workspaces`, { params }),

  create: (orgId: string, body: { name: string; slug: string; description?: string }) =>
    api.post<Models.Workspace>(`/v1/organizations/${orgId}/workspaces`, body),

  get: (wsId: string) => api.get<Models.Workspace>(`/v1/workspaces/${wsId}`),

  update: (wsId: string, body: { name?: string; description?: string }) =>
    api.patch<Models.Workspace>(`/v1/workspaces/${wsId}`, body),

  delete: (wsId: string) => api.delete(`/v1/workspaces/${wsId}`),

  // Members
  listMembers: (wsId: string, params?: Record<string, unknown>) =>
    api.get<ApiListResponse<Models.WorkspaceMember>>(`/v1/workspaces/${wsId}/members`, { params }),

  addMember: (wsId: string, body: { user_id: string; role: string }) =>
    api.post<Models.WorkspaceMember>(`/v1/workspaces/${wsId}/members`, body),

  updateMemberRole: (wsId: string, userId: string, body: { role: string }) =>
    api.patch<Models.WorkspaceMember>(`/v1/workspaces/${wsId}/members/${userId}`, body),

  removeMember: (wsId: string, userId: string) =>
    api.delete(`/v1/workspaces/${wsId}/members/${userId}`),
} as const
