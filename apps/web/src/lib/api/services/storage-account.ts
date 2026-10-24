import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { StorageAccountResources } from './types/storage-account'

import { ClientFetchApi } from '../client-fetch'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

const storageAccountResources = (): StorageAccountResources => {
  return {
    // The server requires the workspace_id query parameter.
    list: (workspaceId, params) => {
      return api.get(`/api/v1/storage/accounts`, {
        params: { workspace_id: workspaceId, ...params },
      })
    },
    connect: (reqBody) => {
      return api.post(`/api/v1/storage/accounts`, reqBody)
    },
    get: (accountId) => {
      return api.get(`/api/v1/storage/accounts/${accountId}`)
    },
    update: (accountId, reqBody) => {
      return api.patch(`/api/v1/storage/accounts/${accountId}`, reqBody)
    },
    rotate: (accountId, credentials) => {
      return api.put(`/api/v1/storage/accounts/${accountId}/credentials`, { credentials })
    },
    disconnect: (accountId) => {
      return api.delete(`/api/v1/storage/accounts/${accountId}`)
    },
    authorizeOAuth: (providerSlug, workspaceId) => {
      return api.post(`/api/v1/storage/oauth/${providerSlug}/authorize`, {
        workspace_id: workspaceId,
      })
    },
    refreshOAuth: (accountId) => {
      return api.post(`/api/v1/storage/accounts/${accountId}/refresh`)
    },
    quota: (accountId) => {
      return api.get(`/api/v1/storage/accounts/${accountId}/quota`)
    },
  }
}

export const storageAccountServices = {
  ...storageAccountResources(),
}
