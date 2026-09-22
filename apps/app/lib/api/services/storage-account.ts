import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import { ClientFetchApi } from '../client-fetch'
import { StorageAccountResources } from './types/storage-account'

const api = new ClientFetchApi({
  baseURL: String(env.NEXT_PUBLIC_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

const storageAccountResources = (): StorageAccountResources => {
  return {
    // The server requires the workspace_id query parameter.
    list: (workspaceId, params) => {
      return api.get(`/v1/storage/accounts`, {
        params: { workspace_id: workspaceId, ...params },
      })
    },
    connect: (reqBody) => {
      return api.post(`/v1/storage/accounts`, reqBody)
    },
    get: (accountId) => {
      return api.get(`/v1/storage/accounts/${accountId}`)
    },
    update: (accountId, reqBody) => {
      return api.patch(`/v1/storage/accounts/${accountId}`, reqBody)
    },
    rotate: (accountId, credentials) => {
      return api.put(`/v1/storage/accounts/${accountId}/credentials`, { credentials })
    },
    disconnect: (accountId) => {
      return api.delete(`/v1/storage/accounts/${accountId}`)
    },
  }
}

export const storageAccountServices = {
  ...storageAccountResources(),
}
