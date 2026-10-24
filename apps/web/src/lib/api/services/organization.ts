import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type {
  OrganizationInvitationResources,
  OrganizationMemberResources,
  OrganizationResources,
} from './types/organization'

import { ClientFetchApi } from '../client-fetch'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

const organizationResources = (): OrganizationResources => {
  return {
    list: (params) => {
      return api.get(`/api/v1/organizations`, { params })
    },
    create: (reqBody) => {
      return api.post(`/api/v1/organizations`, reqBody)
    },
    get: (orgId) => {
      return api.get(`/api/v1/organizations/${orgId}`)
    },
    update: (orgId, reqBody) => {
      return api.patch(`/api/v1/organizations/${orgId}`, reqBody)
    },
    delete: (orgId) => {
      return api.delete(`/api/v1/organizations/${orgId}`)
    },
  }
}

const organizationMemberResources = (): OrganizationMemberResources => {
  return {
    list: (orgId, params) => {
      return api.get(`/api/v1/organizations/${orgId}/members`, { params })
    },
    add: (orgId, reqBody) => {
      return api.post(`/api/v1/organizations/${orgId}/members`, reqBody)
    },
    update: (orgId, userId, reqBody) => {
      return api.patch(`/api/v1/organizations/${orgId}/members/${userId}`, reqBody)
    },
    remove: (orgId, userId) => {
      return api.delete(`/api/v1/organizations/${orgId}/members/${userId}`)
    },
  }
}

const organizationInvitationResources = (): OrganizationInvitationResources => {
  return {
    list: (orgId, params) => {
      return api.get(`/api/v1/organizations/${orgId}/invitations`, { params })
    },
    create: (orgId, reqBody) => {
      return api.post(`/api/v1/organizations/${orgId}/invitations`, reqBody)
    },
    update: (orgId, invitationId, reqBody) => {
      return api.patch(`/api/v1/organizations/${orgId}/invitations/${invitationId}`, reqBody)
    },
    delete: (orgId, invitationId) => {
      return api.delete(`/api/v1/organizations/${orgId}/invitations/${invitationId}`)
    },
  }
}

export const organizationServices = {
  ...organizationResources(),
  members: organizationMemberResources(),
  invitations: organizationInvitationResources(),
}
