import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { DEFAULT_PAGINATE } from '@/lib/constants/paginate'
import { getQueryClient } from '@/lib/providers/react-query'

import { PaginateDto } from '../dtos/paginate'
import { services } from '../services'
import { ConnectStorageAccountBody } from '../services/types/storage-account'
import { GetBaseParams } from './types/param'

export const LIST_STORAGE_ACCOUNT_QUERY_KEY = (wsId: string, params?: PaginateDto) => {
  return ['storage/accounts', wsId, params]
}

export const GET_STORAGE_ACCOUNT_QUERY_KEY = (id: string) => {
  return ['storage/accounts/id', id]
}

const list = (wsId: string, params?: PaginateDto) =>
  queryOptions({
    queryKey: LIST_STORAGE_ACCOUNT_QUERY_KEY(wsId, params),
    queryFn: async () => {
      const pagination = {
        offset: params?.offset ?? DEFAULT_PAGINATE.offset,
        limit: params?.limit ?? DEFAULT_PAGINATE.limit,
        order_by: params?.order_by,
        order: params?.order,
      }

      const res = await services.storageAccount.list(wsId, pagination)
      return res.data
    },
    enabled: !!wsId,
  })

const get = (params: GetBaseParams) =>
  queryOptions({
    queryKey: GET_STORAGE_ACCOUNT_QUERY_KEY(params.id),
    queryFn: async () => {
      const res = await services.storageAccount.get(params.id)
      return res.data
    },
  })

const connect = () =>
  mutationOptions({
    mutationFn: async (reqBody: ConnectStorageAccountBody) => {
      const res = await services.storageAccount.connect(reqBody)
      return res.data
    },
    onSuccess: (account) => {
      getQueryClient().invalidateQueries({
        queryKey: ['storage/accounts', account.data.workspace_id],
      })
    },
  })

const update = (wsId: string) =>
  mutationOptions({
    mutationFn: async ({
      accountId,
      ...reqBody
    }: {
      accountId: string
      display_name?: string
      status?: string
      settings?: Record<string, unknown>
    }) => {
      const res = await services.storageAccount.update(accountId, reqBody)
      return res.data
    },
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: ['storage/accounts', wsId] })
    },
  })

const rotate = (wsId: string) =>
  mutationOptions({
    mutationFn: async ({
      accountId,
      credentials,
    }: {
      accountId: string
      credentials: Record<string, unknown>
    }) => {
      const res = await services.storageAccount.rotate(accountId, credentials)
      return res.data
    },
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: ['storage/accounts', wsId] })
    },
  })

const disconnect = (wsId: string) =>
  mutationOptions({
    mutationFn: async (accountId: string) => {
      const res = await services.storageAccount.disconnect(accountId)
      return res.data
    },
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: ['storage/accounts', wsId] })
    },
  })

export const storageAccountQueries = {
  list,
  get,
  connect,
  update,
  rotate,
  disconnect,
} as const
