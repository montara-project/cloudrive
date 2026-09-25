'use client'

import { IconPlus } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useMemo, useState } from 'react'

import ReactTable from '@/components/block/common/react-table'
import { Button } from '@/components/ui/button'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import { useWorkspaceContext } from '@/hooks/use-workspace-context'
import { queries } from '@/lib/api/queries'
import { getTotal } from '@/lib/constants/paginate'

import SectionCard from '../common/section-card'
import { WorkspaceColumn } from './column'
import { AddWorkspaceForm } from './form'

export default function WorkspaceContent() {
  const [openAdd, setOpenAdd] = useState(false)
  const { organization, orgId } = useWorkspaceContext()

  const { offset, limit, pageIndex } = usePaginationQuery()
  const defaultQueryParams = useMemo(() => ({ offset, limit }), [offset, limit])

  const {
    data: workspaces,
    isLoading,
    isFetching,
    isPending,
  } = useQuery(queries.workspaces.list(orgId, defaultQueryParams))

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
        description={
          organization
            ? `Workspaces inside ${organization.name}.`
            : 'Workspaces inside the selected organization.'
        }
        toolbar={
          <Button variant="primary" size="sm" disabled={!orgId} onClick={() => setOpenAdd(true)}>
            <IconPlus className="size-4" /> New workspace
          </Button>
        }
      >
        {!orgId ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Pick an organization in the sidebar, or{' '}
            <Link href="/settings?tab=organizations" className="text-primary hover:underline">
              create your first one
            </Link>
            .
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
