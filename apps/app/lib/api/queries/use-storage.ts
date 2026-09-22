import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { ConnectStorageAccountBody } from '../services/storage-account'

import { services } from '../services'
import { queryKeys } from './keys'

export function useProviders() {
  return useQuery({
    queryKey: queryKeys.providers,
    queryFn: () => services.provider.list().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  })
}

export function useStorageAccounts(wsId: string | undefined, params?: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.storageAccounts.list(wsId ?? '', params),
    queryFn: () => services.storageAccount.list(wsId!, params).then((r) => r.data),
    enabled: !!wsId,
  })
}

function useInvalidateAccounts(wsId: string) {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['storage-accounts', 'list', wsId] })
}

export function useConnectStorageAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ConnectStorageAccountBody) =>
      services.storageAccount.connect(body).then((r) => r.data),
    onSuccess: (account) =>
      qc.invalidateQueries({ queryKey: ['storage-accounts', 'list', account.workspace_id] }),
  })
}

export function useUpdateStorageAccount(wsId: string) {
  const invalidate = useInvalidateAccounts(wsId)
  return useMutation({
    mutationFn: ({
      accountId,
      ...body
    }: {
      accountId: string
      display_name?: string
      status?: string
      settings?: Record<string, unknown>
    }) => services.storageAccount.update(accountId, body).then((r) => r.data),
    onSuccess: () => invalidate(),
  })
}

export function useRotateCredentials(wsId: string) {
  const invalidate = useInvalidateAccounts(wsId)
  return useMutation({
    mutationFn: ({
      accountId,
      credentials,
    }: {
      accountId: string
      credentials: Record<string, unknown>
    }) => services.storageAccount.rotate(accountId, credentials),
    onSuccess: () => invalidate(),
  })
}

export function useDisconnectStorageAccount(wsId: string) {
  const invalidate = useInvalidateAccounts(wsId)
  return useMutation({
    mutationFn: (accountId: string) => services.storageAccount.disconnect(accountId),
    onSuccess: () => invalidate(),
  })
}

// ── S3 gateway ─────────────────────────────────────────────────────────

export function useS3Credentials(wsId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.s3.credentials(wsId ?? ''),
    queryFn: () => services.s3.listCredentials(wsId!).then((r) => r.data),
    enabled: !!wsId,
  })
}

export function useCreateS3Credential(wsId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { label?: string }) =>
      services.s3.createCredential(wsId, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.s3.credentials(wsId) }),
  })
}

export function useRevokeS3Credential(wsId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (credentialId: string) => services.s3.revokeCredential(wsId, credentialId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.s3.credentials(wsId) }),
  })
}

export function useS3Buckets(wsId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.s3.buckets(wsId ?? ''),
    queryFn: () => services.s3.listBuckets(wsId!).then((r) => r.data),
    enabled: !!wsId,
  })
}

export function useCreateS3Bucket(wsId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; storage_account_id: string; root_prefix?: string }) =>
      services.s3.createBucket(wsId, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.s3.buckets(wsId) }),
  })
}

export function useDeleteS3Bucket(wsId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (bucketId: string) => services.s3.deleteBucket(wsId, bucketId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.s3.buckets(wsId) }),
  })
}
