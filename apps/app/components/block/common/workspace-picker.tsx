'use client'

import { useQueryState } from 'nuqs'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useOrganizations, useWorkspaces } from '@/lib/api/queries'

/**
 * Organization → workspace selectors synced to the `org`/`ws` query params.
 * Workspace-scoped pages (storage accounts, S3 gateway) read the selection
 * from these params.
 */
export default function WorkspacePicker() {
  const [orgId, setOrgId] = useQueryState('org')
  const [wsId, setWsId] = useQueryState('ws')

  const orgs = useOrganizations({ limit: 100 })
  const workspaces = useWorkspaces(orgId ?? undefined, { limit: 100 })

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={orgId ?? ''}
        onValueChange={(v) => {
          setOrgId(v)
          setWsId(null)
        }}
      >
        <SelectTrigger className="h-9 min-w-44">
          <SelectValue placeholder={orgs.isLoading ? 'Loading…' : 'Select organization'} />
        </SelectTrigger>
        <SelectContent>
          {(orgs.data?.data ?? []).map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={wsId ?? ''} onValueChange={setWsId} disabled={!orgId}>
        <SelectTrigger className="h-9 min-w-44">
          <SelectValue
            placeholder={
              !orgId
                ? 'Pick an organization first'
                : workspaces.isLoading
                  ? 'Loading…'
                  : 'Select workspace'
            }
          />
        </SelectTrigger>
        <SelectContent>
          {(workspaces.data?.data ?? []).map((w) => (
            <SelectItem key={w.id} value={w.id}>
              {w.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
