import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import { ClientFetchApi } from '../client-fetch'
import { DriveResources, S3BucketResources, S3CredentialResources } from './types/s3'

const api = new ClientFetchApi({
  baseURL: String(env.NEXT_PUBLIC_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

// Credentials — secret_key is returned once on creation, never again.
const s3CredentialResources = (): S3CredentialResources => {
  return {
    list: (wsId, params) => {
      return api.get(`/v1/workspaces/${wsId}/s3/credentials`, { params })
    },
    create: (wsId, reqBody) => {
      return api.post(`/v1/workspaces/${wsId}/s3/credentials`, reqBody)
    },
    revoke: (wsId, credentialId) => {
      return api.delete(`/v1/workspaces/${wsId}/s3/credentials/${credentialId}`)
    },
  }
}

const s3BucketResources = (): S3BucketResources => {
  return {
    list: (wsId, params) => {
      return api.get(`/v1/workspaces/${wsId}/s3/buckets`, { params })
    },
    create: (wsId, reqBody) => {
      return api.post(`/v1/workspaces/${wsId}/s3/buckets`, reqBody)
    },
    delete: (wsId, bucketId) => {
      return api.delete(`/v1/workspaces/${wsId}/s3/buckets/${bucketId}`)
    },
    recentFiles: (wsId, params) => {
      return api.get(`/v1/workspaces/${wsId}/s3/recent-files`, { params })
    },
  }
}

// My Drive — browse provider accounts' drives one level at a time.
const driveResources = (): DriveResources => {
  return {
    list: (wsId, params) => {
      return api.get(`/v1/workspaces/${wsId}/drive`, {
        params: {
          prefix: params?.prefix || undefined,
          account: params?.account || undefined,
          offset: params?.offset,
          limit: params?.limit,
        },
      })
    },
  }
}

export const s3Services = {
  credentials: s3CredentialResources(),
  buckets: s3BucketResources(),
  drive: driveResources(),
}
