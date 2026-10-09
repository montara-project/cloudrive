'use client'

import { useQuery } from '@tanstack/react-query'
import { useQueryState } from 'nuqs'
import { useEffect } from 'react'

import type { Models } from '@/lib/api/models'

import { queries } from '@/lib/api/queries'

import { useHydrated } from './use-hydrated'

export interface WorkspaceContext {
  organizations: Models.Organization[]
  workspaces: Models.Workspace[]
  organization?: Models.Organization
  workspace?: Models.Workspace
  /** Resolved organization id — the selected one, else the first available. */
  orgId: string
  /** Resolved workspace id — the selected one, else the first in the organization. */
  wsId: string
  isLoading: boolean
  selectOrganization: (id: string) => void
  selectWorkspace: (id: string) => void
}

const LAST_ORG_KEY = 'cloudrive.context.organization'
const lastWorkspaceKey = (orgId: string) => `cloudrive.context.workspace.${orgId}`

const readStored = (key: string) =>
  typeof window === 'undefined' ? null : window.localStorage.getItem(key)

const writeStored = (key: string, value: string) => {
  if (typeof window !== 'undefined') window.localStorage.setItem(key, value)
}

/**
 * Single source of truth for the organization + workspace the app is scoped to.
 *
 * The selection lives in the `org` / `ws` query params so links stay shareable
 * and every workspace-scoped page (storage accounts, S3 gateway) reads the same
 * context the sidebar header displays. When a param is absent the last-used
 * selection (localStorage) is restored — otherwise plain navigation would
 * silently reset the scope to the first organization — and failing that the
 * first available entry is used, so scoped pages never dead-end.
 *
 * Stored values are only read after hydration (`useHydrated`): they don't
 * exist on the server, so reading them during the hydration render would
 * diverge from the SSR output.
 */
export function useWorkspaceContext(): WorkspaceContext {
  const [orgParam, setOrgParam] = useQueryState('org')
  const [wsParam, setWsParam] = useQueryState('ws')
  const [, setPage] = useQueryState('page')
  const hydrated = useHydrated()

  const orgs = useQuery(queries.organizations.list({ limit: 100 }))
  const organizations = orgs.data?.data ?? []

  const organization =
    organizations.find((o) => o.id === orgParam) ??
    (hydrated ? organizations.find((o) => o.id === readStored(LAST_ORG_KEY)) : undefined) ??
    organizations[0]
  const orgId = organization?.id ?? ''

  const workspacesQuery = useQuery(queries.workspaces.list(orgId, { limit: 100 }))
  const workspaces = workspacesQuery.data?.data ?? []

  const workspace =
    workspaces.find((w) => w.id === wsParam) ??
    (hydrated ? workspaces.find((w) => w.id === readStored(lastWorkspaceKey(orgId))) : undefined) ??
    workspaces[0]

  // Persist the resolved context — including selections that arrived via a
  // shared `?org=`/`?ws=` link rather than a picker click — so it survives
  // navigation to pages that don't carry the params.
  useEffect(() => {
    if (organization) writeStored(LAST_ORG_KEY, organization.id)
  }, [organization])

  useEffect(() => {
    if (workspace) writeStored(lastWorkspaceKey(orgId), workspace.id)
  }, [workspace, orgId])

  // Lists are paginated per context — a page index from the previous
  // organization/workspace would land on an empty page.
  const resetPagination = () => setPage(null)

  const selectOrganization = (id: string) => {
    setOrgParam(id)
    // Workspaces are scoped to an organization — never carry a stale one over.
    setWsParam(null)
    resetPagination()
  }

  const selectWorkspace = (id: string) => {
    setWsParam(id)
    resetPagination()
  }

  return {
    organizations,
    workspaces,
    organization,
    workspace,
    orgId,
    wsId: workspace?.id ?? '',
    isLoading: orgs.isLoading || workspacesQuery.isLoading,
    selectOrganization,
    selectWorkspace,
  }
}
