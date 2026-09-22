import { AxiosDeleteResponse, AxiosItemResponse, AxiosListResponse } from '@/types/api'

import { PaginateDto } from '../../dtos/paginate'
import { Models } from '../../models'

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

export type StorageAccountResources = {
  list: (
    workspaceId: string,
    params?: PaginateDto
  ) => Promise<AxiosListResponse<Models.StorageAccount>>
  connect: (reqBody: ConnectStorageAccountBody) => Promise<AxiosItemResponse<Models.StorageAccount>>
  get: (accountId: string) => Promise<AxiosItemResponse<Models.StorageAccount>>
  update: (
    accountId: string,
    reqBody: { display_name?: string; status?: string; settings?: Record<string, unknown> }
  ) => Promise<AxiosItemResponse<Models.StorageAccount>>
  rotate: (
    accountId: string,
    credentials: Record<string, unknown>
  ) => Promise<AxiosItemResponse<Models.StorageAccount>>
  disconnect: (accountId: string) => Promise<AxiosDeleteResponse>
}
