'use client'

import { IconPlug } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import ReactTable from '@/components/block/common/react-table'
import { Button } from '@/components/ui/button'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import { useWorkspaceContext } from '@/hooks/use-workspace-context'
import { queries } from '@/lib/api/queries'
import { getTotal } from '@/lib/constants/paginate'

import SectionCard from '../common/section-card'
import { StorageAccountColumn } from './column'
import { ConnectStorageAccountForm } from './form'

export default function StorageContent() {
  const [openAdd, setOpenAdd] = useState(false)
  const { workspace, wsId } = useWorkspaceContext()

  const { offset, limit, pageIndex } = usePaginationQuery()
  const defaultQueryParams = useMemo(() => ({ offset, limit }), [offset, limit])

  const {
    data: accounts,
    isLoading,
    isFetching,
    isPending,
  } = useQuery(queries.storageAccounts.list(wsId, defaultQueryParams))

  const total = getTotal(accounts)
  const columns = StorageAccountColumn({
    loading: isLoading || isFetching || isPending,
    wsId,
  })
  const rows = useMemo(
    () => (accounts?.data && accounts?.data?.length > 0 ? accounts.data : []),
    [accounts]
  )

  return (
    <>
      <SectionCard
        title="Storage Accounts"
        description={
          workspace
            ? `Cloud provider accounts connected to ${workspace.name}.`
            : 'Cloud provider accounts connected to the selected workspace.'
        }
        toolbar={
          <Button variant="primary" size="sm" disabled={!wsId} onClick={() => setOpenAdd(true)}>
            <IconPlug className="size-4" /> Connect account
          </Button>
        }
      >
        {!wsId ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Pick a workspace in the sidebar to manage its storage accounts.
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

        {wsId && <ConnectStorageAccountForm wsId={wsId} open={openAdd} onOpenChange={setOpenAdd} />}
      </SectionCard>
    </>
  )
}
