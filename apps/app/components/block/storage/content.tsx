'use client'

import { IconPlug } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import ReactTable from '@/components/block/common/react-table'
import { Button } from '@/components/ui/button'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import { useWorkspaceContext } from '@/hooks/use-workspace-context'
import { queries } from '@/lib/api/queries'
import { getTotal } from '@/lib/constants/paginate'

import SectionCard from '../common/section-card'
import { StorageAccountColumn } from './column'
import { ConnectStorageAccountForm } from './form'

// OAuthCallbackToast reads the server callback's query result
// (?connected=<slug>&status=ok|error&reason=…), surfaces it, and strips the
// params so a refresh does not replay the toast.
function useOAuthCallbackToast() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)
    const connected = params.get('connected')
    if (!connected) return

    const status = params.get('status')
    const reason = params.get('reason')

    if (status === 'ok') {
      toast.success(`${connected.replace('_', ' ')} connected`, {
        description: 'The storage account is ready to use.',
      })
    } else {
      toast.error(`${connected.replace('_', ' ')} connection failed`, {
        description: REASON_DESCRIPTIONS[reason ?? ''] ?? 'Try connecting the account again.',
      })
    }

    params.delete('connected')
    params.delete('status')
    params.delete('reason')
    const query = params.toString()
    window.history.replaceState(
      window.history.state,
      '',
      window.location.pathname + (query ? `?${query}` : '')
    )
  }, [])
}

// REASON_DESCRIPTIONS maps the server's stable error reasons (never raw
// provider payloads) to user-facing text.
const REASON_DESCRIPTIONS: Record<string, string> = {
  consent_failed: 'Authorization was cancelled or the provider returned an error.',
  invalid_state: 'The connect request expired or was tampered with. Start the connection again.',
  missing_code: 'The provider did not return an authorization code.',
  exchange_failed: 'The authorization code could not be exchanged for tokens.',
  provider_not_configured: 'This provider is not configured on the server yet.',
  provider_not_found: 'Unknown storage provider.',
  workspace_not_found: 'The workspace for this connection no longer exists.',
  persist_failed: 'The account could not be saved. Check the server logs.',
}

export default function StorageContent() {
  const [openAdd, setOpenAdd] = useState(false)
  useOAuthCallbackToast()
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
