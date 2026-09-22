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
}
