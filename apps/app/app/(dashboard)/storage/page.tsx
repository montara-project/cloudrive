'use client'

import { IconDotsVertical, IconKey, IconPencil, IconPlug, IconTrash } from '@tabler/icons-react'
import { useQueryState } from 'nuqs'
import { useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import DataTable, { type DataTableColumn } from '@/components/block/common/data-table'
import SectionCard from '@/components/block/common/section-card'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import SimpleDialog from '@/components/block/common/simple-dialog'
import StatusBadge from '@/components/block/common/status-badge'
import WorkspacePicker from '@/components/block/common/workspace-picker'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Field } from '@/components/ui/field'
import { useAppForm } from '@/hooks/form'
import { throwAxiosError } from '@/lib/api/axios-error'
import { UpdateStorageAccountSchema } from '@/lib/api/dtos/storage-account/schema'
import {
  useConnectStorageAccount,
  useDisconnectStorageAccount,
  useProviders,
  useRotateCredentials,
  useStorageAccounts,
  useUpdateStorageAccount,
} from '@/lib/api/queries'

type StorageAccount = Models.StorageAccount

function toastError(error: unknown) {
  try {
    throwAxiosError(error as Error)
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'An error occurred')
  }
}

// ── Connect dialog ─────────────────────────────────────────────────────

function ConnectDialog({
  wsId,
  open,
  onOpenChange,
}: {
  wsId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const providers = useProviders()
  const connect = useConnectStorageAccount()
  const [isLoading, setIsLoading] = useState(false)

  const providerOptions = (providers.data?.data ?? [])
    .filter((p) => p.is_active)
    .map((p) => ({ label: p.name, value: p.id }))

  const form = useAppForm({
    defaultValues: {
      provider_id: '',
      display_name: '',
      account_email: '',
      external_account_id: '',
      credentials: '',
      settings: '',
    },
    onSubmit: async ({ value }) => {
      setIsLoading(true)
      try {
        let credentials: Record<string, unknown>
        try {
          credentials = JSON.parse(value.credentials)
        } catch {
          toast.error('Credentials must be a valid JSON object')
          setIsLoading(false)
          return
        }
        let settings: Record<string, unknown> | undefined
        if (value.settings?.trim()) {
          try {
            settings = JSON.parse(value.settings)
          } catch {
            toast.error('Settings must be a valid JSON object')
            setIsLoading(false)
            return
          }
        }
        await connect.mutateAsync({
          workspace_id: wsId,
          provider_id: value.provider_id,
          display_name: value.display_name,
          external_account_id: value.external_account_id,
          credentials,
          ...(value.account_email ? { account_email: value.account_email } : {}),
          ...(settings ? { settings } : {}),
        })
        toast.success('Storage account connected')
        onOpenChange(false)
      } catch (error) {
        toastError(error)
      } finally {
        setIsLoading(false)
      }
    },
  })

  return (
    <SimpleDialog
      title="Connect storage account"
      description="Link a cloud storage provider account to this workspace."
      open={open}
      onOpenChange={onOpenChange}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
      >
        <form.AppField
          name="provider_id"
          children={(field) => (
            <field.SelectField
              label="Provider"
              placeholder="Select provider"
              options={providerOptions}
              loading={providers.isLoading}
              asterisk
            />
          )}
        />
        <form.AppField
          name="display_name"
          children={(field) => (
            <field.TextField label="Display name" placeholder="Production bucket" asterisk />
          )}
        />
        <form.AppField
          name="external_account_id"
          children={(field) => (
            <field.TextField
              label="External account ID"
              placeholder="Bucket name / account ID at the provider"
              asterisk
            />
          )}
        />
        <form.AppField
          name="account_email"
          children={(field) => <field.TextField label="Account email" placeholder="Optional" />}
        />
        <form.AppField
          name="credentials"
          children={(field) => (
            <field.TextareaField
              label="Credentials (JSON)"
              placeholder='{"access_key_id": "…", "secret_access_key": "…"}'
              note="Stored encrypted. Shape depends on the provider's auth type."
              rows={4}
              asterisk
            />
          )}
        />
        <form.AppField
          name="settings"
          children={(field) => (
            <field.TextareaField
              label="Settings (JSON, optional)"
              placeholder='{"region": "us-east-1"}'
              rows={3}
            />
          )}
        />
        <Field className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isLoading}>
            {isLoading ? 'Connecting…' : 'Connect'}
          </Button>
        </Field>
      </form>
    </SimpleDialog>
  )
}

// ── Edit dialog ────────────────────────────────────────────────────────

function EditDialog({
  wsId,
  account,
  open,
  onOpenChange,
}: {
  wsId: string
  account: StorageAccount
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const update = useUpdateStorageAccount(wsId)
  const [isLoading, setIsLoading] = useState(false)

  const form = useAppForm({
    defaultValues: {
      display_name: account.display_name,
      status: account.status as 'active' | 'pending_auth' | 'expired' | 'revoked' | 'error',
    },
    validators: {
      onSubmit: UpdateStorageAccountSchema,
    },
    onSubmit: async ({ value }) => {
      setIsLoading(true)
      try {
        await update.mutateAsync({
          accountId: account.id,
          display_name: value.display_name,
          status: value.status,
        })
        toast.success('Storage account updated')
        onOpenChange(false)
      } catch (error) {
        toastError(error)
      } finally {
        setIsLoading(false)
      }
    },
  })

  return (
    <SimpleDialog title="Edit storage account" open={open} onOpenChange={onOpenChange}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
      >
        <form.AppField
          name="display_name"
          children={(field) => <field.TextField label="Display name" asterisk />}
        />
        <form.AppField
          name="status"
          children={(field) => (
            <field.SelectField
              label="Status"
              options={[
                { label: 'Active', value: 'active' },
                { label: 'Pending auth', value: 'pending_auth' },
                { label: 'Expired', value: 'expired' },
                { label: 'Revoked', value: 'revoked' },
                { label: 'Error', value: 'error' },
              ]}
            />
          )}
        />
        <Field className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isLoading}>
            {isLoading ? 'Saving…' : 'Save changes'}
          </Button>
        </Field>
      </form>
    </SimpleDialog>
  )
}

// ── Rotate credentials dialog ──────────────────────────────────────────

function RotateDialog({
  wsId,
  account,
  open,
  onOpenChange,
}: {
  wsId: string
  account: StorageAccount
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const rotate = useRotateCredentials(wsId)
  const [isLoading, setIsLoading] = useState(false)

  const form = useAppForm({
    defaultValues: { credentials: '' },
    onSubmit: async ({ value }) => {
      setIsLoading(true)
      try {
        let credentials: Record<string, unknown>
        try {
          credentials = JSON.parse(value.credentials)
        } catch {
          toast.error('Credentials must be a valid JSON object')
          setIsLoading(false)
          return
        }
        await rotate.mutateAsync({ accountId: account.id, credentials })
        toast.success('Credentials rotated')
        onOpenChange(false)
      } catch (error) {
        toastError(error)
      } finally {
        setIsLoading(false)
      }
    },
  })

  return (
    <SimpleDialog
      title="Rotate credentials"
      description={`Replace the stored credentials for "${account.display_name}".`}
      open={open}
      onOpenChange={onOpenChange}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
      >
        <form.AppField
          name="credentials"
          children={(field) => (
            <field.TextareaField
              label="New credentials (JSON)"
              placeholder='{"access_key_id": "…", "secret_access_key": "…"}'
              rows={4}
              asterisk
            />
          )}
        />
        <Field className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isLoading}>
            {isLoading ? 'Rotating…' : 'Rotate'}
          </Button>
        </Field>
      </form>
    </SimpleDialog>
  )
}

// ── Page ───────────────────────────────────────────────────────────────

export default function StoragePage() {
  const [wsId] = useQueryState('ws')
  const accounts = useStorageAccounts(wsId ?? undefined, { limit: 100 })

  const [connecting, setConnecting] = useState(false)
  const [editing, setEditing] = useState<StorageAccount | null>(null)
  const [rotating, setRotating] = useState<StorageAccount | null>(null)
  const [disconnecting, setDisconnecting] = useState<StorageAccount | null>(null)
  const disconnect = useDisconnectStorageAccount(wsId ?? '')

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
          <ConnectDialog wsId={wsId} open={connecting} onOpenChange={setConnecting} />
          {editing && (
            <EditDialog
              wsId={wsId}
              account={editing}
              open
              onOpenChange={(open) => !open && setEditing(null)}
            />
          )}
          {rotating && (
            <RotateDialog
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
            toastError(error)
          }
        }}
      />
    </>
  )
}
