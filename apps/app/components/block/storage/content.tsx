'use client'

import { IconPlugConnected } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { useWorkspaceContext } from '@/hooks/use-workspace-context'

import { ConnectStorageAccountForm } from './form'
import StorageOverview from './overview'

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Storage</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {workspace
              ? `View all cloud accounts connected to ${workspace.name}, then connect or disconnect accounts.`
              : 'View all cloud accounts, their quotas, then connect or disconnect accounts.'}
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          className="rounded-full"
          disabled={!wsId}
          onClick={() => setOpenAdd(true)}
        >
          <IconPlugConnected className="size-4" /> Connect
        </Button>
      </div>

      <StorageOverview onConnect={() => setOpenAdd(true)} />

      {wsId && <ConnectStorageAccountForm wsId={wsId} open={openAdd} onOpenChange={setOpenAdd} />}
    </div>
  )
}
