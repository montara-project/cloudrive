'use client'

import { IconDotsVertical, IconKey, IconPencil, IconPlug, IconTrash } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useQueryState } from 'nuqs'
import { useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import DataTable, { type DataTableColumn } from '@/components/block/common/data-table'
import SectionCard from '@/components/block/common/section-card'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import StatusBadge from '@/components/block/common/status-badge'
import WorkspacePicker from '@/components/block/common/workspace-picker'
import ConnectAccountDialog from '@/components/block/storage/connect-account-dialog'
import EditAccountDialog from '@/components/block/storage/edit-account-dialog'
import RotateCredentialsDialog from '@/components/block/storage/rotate-credentials-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

type StorageAccount = Models.StorageAccount

export default function StoragePage() {
  const [wsId] = useQueryState('ws')
  const accounts = useQuery(queries.storageAccounts.list(wsId ?? '', { limit: 100 }))

  const [connecting, setConnecting] = useState(false)
  const [editing, setEditing] = useState<StorageAccount | null>(null)
  const [rotating, setRotating] = useState<StorageAccount | null>(null)
  const [disconnecting, setDisconnecting] = useState<StorageAccount | null>(null)
  const disconnect = useMutation(queries.storageAccounts.disconnect(wsId ?? ''))

  const columns: DataTableColumn<StorageAccount>[] = [
    {
      header: 'Name',
      cell: (a) => <span className="font-medium">{a.display_name}</span>,
    },
    {
      header: 'Provider account',
      cell: (a) => (
        <span className="font-mono text-xs text-muted-foreground">{a.external_account_id}</span>
      ),
    },
    {
      header: 'Email',
      cell: (a) => <span className="text-muted-foreground">{a.account_email || '—'}</span>,
    },
    { header: 'Status', cell: (a) => <StatusBadge value={a.status} /> },
    {
      header: 'Last synced',
      cell: (a) => (
        <span className="text-muted-foreground">
          {a.last_synced_at ? new Date(a.last_synced_at).toLocaleString() : 'Never'}
        </span>
      ),
    },
    {
      header: '',
      className: 'w-12 text-right',
      cell: (a) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8">
              <IconDotsVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditing(a)}>
              <IconPencil className="size-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setRotating(a)}>
              <IconKey className="size-4" /> Rotate credentials
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => setDisconnecting(a)}>
              <IconTrash className="size-4" /> Disconnect
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <>
      <SectionCard
        title="Storage Accounts"
        description="Cloud provider accounts connected to the selected workspace."
        toolbar={
          <div className="flex items-center gap-2">
            <WorkspacePicker />
            <Button
              variant="primary"
              size="sm"
              disabled={!wsId}
              onClick={() => setConnecting(true)}
            >
              <IconPlug className="size-4" /> Connect account
            </Button>
          </div>
        }
      >
        {!wsId ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Select an organization and workspace to manage storage accounts.
          </p>
        ) : (
          <DataTable
            columns={columns}
            rows={accounts.data?.data ?? []}
            loading={accounts.isLoading}
            empty="No storage accounts connected to this workspace."
          />
        )}
      </SectionCard>

      {wsId && (
        <>
          <ConnectAccountDialog wsId={wsId} open={connecting} onOpenChange={setConnecting} />
          {editing && (
            <EditAccountDialog
              wsId={wsId}
              account={editing}
              open
              onOpenChange={(open) => !open && setEditing(null)}
            />
          )}
          {rotating && (
            <RotateCredentialsDialog
              wsId={wsId}
              account={rotating}
              open
              onOpenChange={(open) => !open && setRotating(null)}
            />
          )}
        </>
      )}

      <SimpleAlertDialog
        open={!!disconnecting}
        onOpenChange={(open) => !open && setDisconnecting(null)}
        title="Disconnect storage account"
        description={`Disconnect "${disconnecting?.display_name}"? Buckets backed by this account will stop working.`}
        confirmText="Disconnect"
        onConfirm={async () => {
          if (!disconnecting) return
          try {
            await disconnect.mutateAsync(disconnecting.id)
            toast.success('Storage account disconnected')
            setDisconnecting(null)
          } catch (error) {
            toastAxiosError(error)
          }
        }}
      />
    </>
  )
}
