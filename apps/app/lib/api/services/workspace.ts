import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import { ClientFetchApi } from '../client-fetch'
import { WorkspaceMemberResources, WorkspaceResources } from './types/workspace'

const api = new ClientFetchApi({
  baseURL: String(env.NEXT_PUBLIC_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

const workspaceResources = (): WorkspaceResources => {
  return {
    list: (orgId, params) => {
      return api.get(`/v1/organizations/${orgId}/workspaces`, { params })
    },
    create: (orgId, reqBody) => {
      return api.post(`/v1/organizations/${orgId}/workspaces`, reqBody)
    },
    get: (wsId) => {
      return api.get(`/v1/workspaces/${wsId}`)
    },
    update: (wsId, reqBody) => {
      return api.patch(`/v1/workspaces/${wsId}`, reqBody)
    },
    delete: (wsId) => {
      return api.delete(`/v1/workspaces/${wsId}`)
    },
  }
}

const workspaceMemberResources = (): WorkspaceMemberResources => {
  return {
    list: (wsId, params) => {
      return api.get(`/v1/workspaces/${wsId}/members`, { params })
    },
    add: (wsId, reqBody) => {
      return api.post(`/v1/workspaces/${wsId}/members`, reqBody)
    },
    update: (wsId, userId, reqBody) => {
      return api.patch(`/v1/workspaces/${wsId}/members/${userId}`, reqBody)
    },
    remove: (wsId, userId) => {
      return api.delete(`/v1/workspaces/${wsId}/members/${userId}`)
    },
  }
}

export const workspaceServices = {
  ...workspaceResources(),
  members: workspaceMemberResources(),
}
