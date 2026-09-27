'use client'

import { useQueries, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import type { Models } from '@/lib/api/models'

import { queries } from '@/lib/api/queries'

export type AccountUsage = {
  used: number
  total: number
}

/**
 * useStorageUsage aggregates provider-reported quota for the workspace's
 * connected accounts. Quotas come from the per-account quota endpoint, which
 * only OAuth (oauth2_cloud) providers implement — S3-style accounts are
 * skipped, and failed provider calls are excluded instead of failing the
 * aggregate. React Query's 5-minute staleTime keeps the fan-out cheap.
 */
export function useStorageUsage(wsId?: string) {
  const accountsQuery = useQuery(
    queries.storageAccounts.list(wsId ?? '', { offset: 0, limit: 100 })
  )
  const providersQuery = useQuery(queries.providers.list())

  const accounts: Models.StorageAccount[] = useMemo(
    () => accountsQuery.data?.data ?? [],
    [accountsQuery.data]
  )

  const oauthProviderIds = useMemo(() => {
    const providers = providersQuery.data?.data ?? []
    return new Set(providers.filter((p) => p.protocol === 'oauth2_cloud').map((p) => p.id))
  }, [providersQuery.data])

  const quotaAccounts = useMemo(
    () => accounts.filter((a) => a.status === 'active' && oauthProviderIds.has(a.provider_id)),
    [accounts, oauthProviderIds]
  )

  const quotaQueries = useQueries({
    queries: quotaAccounts.map((account) => ({
      ...queries.storageAccounts.quota(account.id),
      retry: false,
    })),
  })

  const usage = useMemo(() => {
    const map = new Map<string, AccountUsage>()
    quotaQueries.forEach((query, index) => {
      const data = query.data
      if (!data || typeof data.total_bytes !== 'number' || data.total_bytes <= 0) return
      map.set(quotaAccounts[index].id, { used: data.used_bytes, total: data.total_bytes })
    })

    // Dev-only preview: `?mockQuota` fills reportable accounts with fake
    // usage so the quota UI can be styled without live provider credentials.
    // The branch is compiled out of production builds.
    if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.has('mockQuota')) {
        const fractions = [0.004, 0.18, 0.87, 0.4]
        accounts
          .filter((a) => a.status === 'active')
          .forEach((account, index) => {
            map.set(account.id, {
              used: Math.round(400e9 * fractions[index % fractions.length]),
              total: 400e9 + 57e9 * ((index % 3) + 1),
            })
          })
      }
    }

    return map
  }, [quotaQueries, quotaAccounts, accounts])

  const totals = useMemo(() => {
    let used = 0
    let total = 0
    usage.forEach((value) => {
      used += value.used
      total += value.total
    })
    return { used, total, hasUsage: usage.size > 0 }
  }, [usage])

  const providerById = useMemo(() => {
    const map = new Map<string, Models.Provider>()
    ;(providersQuery.data?.data ?? []).forEach((provider) => map.set(provider.id, provider))
    return map
  }, [providersQuery.data])

  return {
    accounts,
    isLoading: accountsQuery.isLoading || providersQuery.isLoading,
    usage,
    providerById,
    ...totals,
  }
}
