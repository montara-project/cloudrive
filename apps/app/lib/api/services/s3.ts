import type { ApiListResponse } from '@/types/api'

import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { Models } from '../models'

import { ClientFetchApi } from '../client-fetch'

const api = new ClientFetchApi({
  baseURL: String(env.NEXT_PUBLIC_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

const base = (wsId: string) => `/v1/workspaces/${wsId}/s3`

export const s3Services = {
  // Credentials — secret_key is returned once on creation, never again.
  listCredentials: (wsId: string, params?: Record<string, unknown>) =>
    api.get<ApiListResponse<Models.S3Credential>>(`${base(wsId)}/credentials`, { params }),

  createCredential: (wsId: string, body: { label?: string }) =>
    api.post<Models.S3Credential>(`${base(wsId)}/credentials`, body),

  revokeCredential: (wsId: string, credentialId: string) =>
    api.delete(`${base(wsId)}/credentials/${credentialId}`),

  // Buckets
  listBuckets: (wsId: string, params?: Record<string, unknown>) =>
    api.get<ApiListResponse<Models.S3Bucket>>(`${base(wsId)}/buckets`, { params }),

  createBucket: (
    wsId: string,
    body: { name: string; storage_account_id: string; root_prefix?: string }
  ) => api.post<Models.S3Bucket>(`${base(wsId)}/buckets`, body),

  deleteBucket: (wsId: string, bucketId: string) => api.delete(`${base(wsId)}/buckets/${bucketId}`),
} as const
