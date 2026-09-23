'use client'

import { useQuery } from '@tanstack/react-query'
import { useQueryState } from 'nuqs'

import type { Models } from '@/lib/api/models'

import { queries } from '@/lib/api/queries'

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

/**
 * Single source of truth for the organization + workspace the app is scoped to.
 *
 * The selection lives in the `org` / `ws` query params so links stay shareable
 * and every workspace-scoped page (storage accounts, S3 gateway) reads the same
 * context the sidebar header displays. When a param is absent the first
 * available organization / workspace is used, so opening a storage page never
 * dead-ends on an empty picker.
 */
export function useWorkspaceContext(): WorkspaceContext {
  const [orgParam, setOrgParam] = useQueryState('org')
  const [wsParam, setWsParam] = useQueryState('ws')
  const [, setPage] = useQueryState('page')

  const orgs = useQuery(queries.organizations.list({ limit: 100 }))
  const organizations = orgs.data?.data ?? []

  const organization = organizations.find((o) => o.id === orgParam) ?? organizations[0]
  const orgId = organization?.id ?? ''

  const workspacesQuery = useQuery(queries.workspaces.list(orgId, { limit: 100 }))
  const workspaces = workspacesQuery.data?.data ?? []

  const workspace = workspaces.find((w) => w.id === wsParam) ?? workspaces[0]

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
