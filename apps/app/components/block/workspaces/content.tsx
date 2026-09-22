'use client'

import { IconPlus } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useQueryState } from 'nuqs'
import { useMemo, useState } from 'react'

import ReactTable from '@/components/block/common/react-table'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import { queries } from '@/lib/api/queries'
import { getTotal } from '@/lib/constants/paginate'

import SectionCard from '../common/section-card'
import { WorkspaceColumn } from './column'
import { AddWorkspaceForm } from './form'

export default function WorkspaceContent() {
  const [openAdd, setOpenAdd] = useState(false)
  const [orgId, setOrgId] = useQueryState('org')

  const { offset, limit, pageIndex } = usePaginationQuery()
  const defaultQueryParams = useMemo(() => ({ offset, limit }), [offset, limit])

  const orgs = useQuery(queries.organizations.list({ limit: 100 }))
  const {
    data: workspaces,
    isLoading,
    isFetching,
    isPending,
  } = useQuery(queries.workspaces.list(orgId ?? '', defaultQueryParams))

  const total = getTotal(workspaces)
  const columns = WorkspaceColumn({ loading: isLoading || isFetching || isPending })
  const rows = useMemo(
    () => (workspaces?.data && workspaces?.data?.length > 0 ? workspaces.data : []),
    [workspaces]
  )

  return (
    <>
      <SectionCard
        title="Workspaces"
        description="Workspaces inside the selected organization."
        toolbar={
          <div className="flex items-center gap-2">
            <Select value={orgId ?? ''} onValueChange={setOrgId}>
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
            <Button variant="primary" size="sm" disabled={!orgId} onClick={() => setOpenAdd(true)}>
              <IconPlus className="size-4" /> New workspace
            </Button>
          </div>
        }
      >
        {!orgId ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Select an organization to see its workspaces.
          </p>
        ) : (
          <ReactTable
            total={total}
            data={rows}
            pageIndex={pageIndex}
            pageSize={limit}
            columns={columns}
          />
        )}

        {orgId && <AddWorkspaceForm open={openAdd} onOpenChange={setOpenAdd} orgId={orgId} />}
      </SectionCard>
    </>
  )
}
