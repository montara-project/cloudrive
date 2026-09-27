import { AxiosDeleteResponse, AxiosItemResponse, AxiosListResponse } from '@/types/api'

import { PaginateDto } from '../../dtos/paginate'
import { Models } from '../../models'

export type S3CredentialResources = {
  list: (wsId: string, params?: PaginateDto) => Promise<AxiosListResponse<Models.S3Credential>>
  create: (
    wsId: string,
    reqBody: { label?: string }
  ) => Promise<AxiosItemResponse<Models.S3Credential>>
  revoke: (wsId: string, credentialId: string) => Promise<AxiosDeleteResponse>
}

export type S3BucketResources = {
  list: (wsId: string, params?: PaginateDto) => Promise<AxiosListResponse<Models.S3Bucket>>
  create: (
    wsId: string,
    reqBody: { name: string; storage_account_id: string; root_prefix?: string }
  ) => Promise<AxiosItemResponse<Models.S3Bucket>>
  delete: (wsId: string, bucketId: string) => Promise<AxiosDeleteResponse>
  recentFiles: (wsId: string, params?: PaginateDto) => Promise<AxiosListResponse<S3RecentFile>>
}

// S3RecentFile is one object aggregated across the workspace's gateway
// buckets, keyed relative to the bucket's root prefix.
export type S3RecentFile = {
  key: string
  bucket: string
  size: number
  content_type?: string
  last_modified: string
  storage_account_id: string
  provider_slug?: string
}

// DriveEntry is one folder or file at a prefix inside a provider account's
// drive, the shape the My Drive browser renders per row.
export type DriveEntry = {
  name: string
  type: 'folder' | 'file'
  size: number
  content_type?: string
  last_modified: string
  account_id: string
  account_name: string
  provider_slug?: string
}

export type DriveResources = {
  list: (
    wsId: string,
    params?: { prefix?: string; account?: string; offset?: number; limit?: number }
  ) => Promise<AxiosListResponse<DriveEntry>>
}
