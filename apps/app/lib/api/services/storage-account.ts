import type { ApiListResponse } from '@/types/api'

import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { Models } from '../models'

import { ClientFetchApi } from '../client-fetch'

const api = new ClientFetchApi({
  baseURL: String(env.NEXT_PUBLIC_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

const base = '/v1/storage/accounts'

export type ConnectStorageAccountBody = {
  workspace_id: string
  provider_id?: string
  provider_slug?: string
  display_name: string
  account_email?: string
  external_account_id: string
  settings?: Record<string, unknown>
  credentials: Record<string, unknown>
}

export const storageAccountServices = {
  // The server requires the workspace_id query parameter.
  list: (workspaceId: string, params?: Record<string, unknown>) =>
    api.get<ApiListResponse<Models.StorageAccount>>(base, {
      params: { workspace_id: workspaceId, ...params },
    }),

  connect: (body: ConnectStorageAccountBody) => api.post<Models.StorageAccount>(base, body),

  get: (accountId: string) => api.get<Models.StorageAccount>(`${base}/${accountId}`),

  update: (
    accountId: string,
    body: { display_name?: string; status?: string; settings?: Record<string, unknown> }
  ) => api.patch<Models.StorageAccount>(`${base}/${accountId}`, body),

  rotate: (accountId: string, credentials: Record<string, unknown>) =>
    api.put(`${base}/${accountId}/credentials`, { credentials }),

  disconnect: (accountId: string) => api.delete(`${base}/${accountId}`),
} as const
