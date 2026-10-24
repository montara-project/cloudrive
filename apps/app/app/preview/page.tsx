'use client'

import { notFound } from 'next/navigation'
import { useEffect, useState } from 'react'

import type { Models } from '@/lib/api/models'
import type { ApiListResponse, Metadata } from '@/types/api'

import SessionLoading from '@/components/block/auth/session-loading'
import DashboardContent from '@/components/block/dashboard/content'
import SidebarLayout from '@/components/layout/sidebar/layout'
import { MOCK_ORG, MOCK_USER, MOCK_WORKSPACES } from '@/data/mock/dashboard'
import { SESSION_QUERY_KEY } from '@/hooks/use-session'
import { queries } from '@/lib/api/queries'
import { getQueryClient } from '@/lib/providers/react-query'

/**
 * DEV-ONLY design preview for the redesigned dashboard — never linked from
 * the nav and compiled out in production builds.
 *
 * The real /dashboard gates on a live session probe and seeded organizations;
 * this route renders the same shell + content with the React Query cache
 * pre-seeded so the layout can be reviewed (and screenshotted) with mock data
 * and no backend. Seeds are reapplied when a seeded query errors or the
 * session probe answers null, so the preview stays stable across refocuses
 * and the session poll.
 */
if (process.env.NODE_ENV === 'production') {
  notFound()
}

const NOW = '2026-10-24T09:00:00.000Z'
const GIB = 1024 ** 3

const ORG: Models.Organization = {
  id: MOCK_ORG.id,
  name: MOCK_ORG.name,
  slug: MOCK_ORG.slug,
  created_by: 'user_preview',
  created_at: NOW,
  updated_at: NOW,
}

const WORKSPACES: Models.Workspace[] = MOCK_WORKSPACES.map((ws, index) => ({
  id: ws.id,
  organization_id: ORG.id,
  name: ws.name,
  slug: ws.slug,
  created_by: 'user_preview',
  created_at: NOW,
  updated_at: NOW,
  description: index === 0 ? 'Everything the Acme team shares' : undefined,
}))

const PROVIDERS: Models.Provider[] = [
  {
    id: 'prv-preview-gdrive',
    slug: 'google_drive',
    name: 'Google Drive',
    protocol: 'oauth2_cloud',
    auth_type: 'oauth2',
    is_active: true,
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: 'prv-preview-dropbox',
    slug: 'dropbox',
    name: 'Dropbox',
    protocol: 'oauth2_cloud',
    auth_type: 'oauth2',
    is_active: true,
    created_at: NOW,
    updated_at: NOW,
  },
]

const ACCOUNTS: Models.StorageAccount[] = [
  {
    id: 'acc-preview-gdrive',
    organization_id: ORG.id,
    workspace_id: WORKSPACES[0].id,
    provider_id: PROVIDERS[0].id,
    owner_user_id: 'user_preview',
    display_name: 'Google Drive — Ruben',
    account_email: MOCK_USER.email,
    external_account_id: 'gdrive-1',
    status: 'active',
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: 'acc-preview-dropbox',
    organization_id: ORG.id,
    workspace_id: WORKSPACES[0].id,
    provider_id: PROVIDERS[1].id,
    owner_user_id: 'user_preview',
    display_name: 'Dropbox — Ruben',
    account_email: MOCK_USER.email,
    external_account_id: 'dropbox-1',
    status: 'active',
    created_at: NOW,
    updated_at: NOW,
  },
]

const SESSION = {
  user: {
    id: 'user_preview',
    email: MOCK_USER.email,
    first_name: MOCK_USER.name.split(' ')[0],
    last_name: MOCK_USER.name.split(' ')[1],
    role: 'owner',
    created_at: NOW,
    updated_at: NOW,
  },
  session: { token: 'preview-token' },
  data: { provider: 'custom' as const },
}

const listResponse = <T,>(data: T[]): ApiListResponse<T, Metadata> => ({
  data,
  metadata: { total: data.length, offset: 0, per_page: data.length },
})

/**
 * Every cache entry the preview needs: session (user card), organizations +
 * workspaces (context, folders, breadcrumb), providers + storage accounts +
 * quotas (search, storage card). Keys are derived from the real queryOptions
 * factories so the components read them unchanged.
 */
function buildSeeds(): Array<[readonly unknown[], unknown]> {
  return [
    [SESSION_QUERY_KEY, SESSION],
    [queries.organizations.list({ limit: 100 }).queryKey, listResponse([ORG])],
    [queries.workspaces.list(ORG.id, { limit: 100 }).queryKey, listResponse(WORKSPACES)],
    [queries.providers.list().queryKey, listResponse(PROVIDERS)],
    [
      queries.storageAccounts.list(WORKSPACES[0].id, { offset: 0, limit: 100 }).queryKey,
      listResponse(ACCOUNTS),
    ],
    [['storage/accounts/quota', ACCOUNTS[0].id], { total_bytes: 700 * GIB, used_bytes: 400 * GIB }],
    [
      ['storage/accounts/quota', ACCOUNTS[1].id],
      { total_bytes: 324 * GIB, used_bytes: 99.3 * GIB },
    ],
  ]
}

export default function PreviewPage() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const queryClient = getQueryClient()
    const seeds = buildSeeds()

    const applySeed = (key: readonly unknown[]) => {
      const seed = seeds.find(([seedKey]) => JSON.stringify(seedKey) === JSON.stringify(key))
      if (seed) queryClient.setQueryData(seed[0], seed[1])
    }

    seeds.forEach(([key, data]) => queryClient.setQueryData(key, data))
    // One frame of the loading shell before the seeded render — keeps the
    // ready flag out of a synchronous setState-in-effect.
    queueMicrotask(() => setReady(true))

    // Keep the preview sticky: the session probe answers null without a live
    // backend and list queries error on refetch — reapply the fixture data.
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      const { query } = event
      if (query.state.status === 'error') applySeed(query.queryKey)
      if (
        JSON.stringify(query.queryKey) === JSON.stringify(SESSION_QUERY_KEY) &&
        query.state.data === null
      ) {
        applySeed(query.queryKey)
      }
    })

    return unsubscribe
  }, [])

  if (!ready) {
    return <SessionLoading />
  }

  return (
    <SidebarLayout>
      <DashboardContent />
    </SidebarLayout>
  )
}
