'use client'

import { IconCopy, IconDotsVertical, IconPlus, IconTrash } from '@tabler/icons-react'
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
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAppForm } from '@/hooks/form'
import { throwAxiosError } from '@/lib/api/axios-error'
import { CreateS3BucketSchema } from '@/lib/api/dtos/s3/schema'
import {
  useCreateS3Bucket,
  useCreateS3Credential,
  useDeleteS3Bucket,
  useRevokeS3Credential,
  useS3Buckets,
  useS3Credentials,
  useStorageAccounts,
} from '@/lib/api/queries'

function toastError(error: unknown) {
  try {
    throwAxiosError(error as Error)
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'An error occurred')
  }
}

// ── Credentials tab ────────────────────────────────────────────────────

function CredentialsTab({ wsId }: { wsId: string }) {
  const credentials = useS3Credentials(wsId)
  const create = useCreateS3Credential(wsId)
  const revoke = useRevokeS3Credential(wsId)

  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<Models.S3Credential | null>(null)
  const [revoking, setRevoking] = useState<Models.S3Credential | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const form = useAppForm({
    defaultValues: { label: '' },
    onSubmit: async ({ value }) => {
      setIsLoading(true)
      try {
        const cred = await create.mutateAsync(value.label ? { label: value.label } : {})
        setCreating(false)
        // secret_key is only present on this response — show it once.
        setCreated(cred)
      } catch (error) {
        toastError(error)
      } finally {
        setIsLoading(false)
      }
    },
  })

  const copy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text)
    toast.success(`${label} copied`)
  }

  const columns: DataTableColumn<Models.S3Credential>[] = [
    {
      header: 'Access key ID',
      cell: (c) => <span className="font-mono text-xs">{c.access_key_id}</span>,
    },
    {
      header: 'Label',
      cell: (c) => <span className="text-muted-foreground">{c.label || '—'}</span>,
    },
    { header: 'Status', cell: (c) => <StatusBadge value={c.status} /> },
    {
      header: 'Last used',
      cell: (c) => (
        <span className="text-muted-foreground">
          {c.last_used_at ? new Date(c.last_used_at).toLocaleString() : 'Never'}
        </span>
      ),
    },
    {
      header: 'Created',
      cell: (c) => (
        <span className="text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</span>
      ),
    },
    {
      header: '',
      className: 'w-12 text-right',
      cell: (c) => (
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-destructive"
          onClick={() => setRevoking(c)}
        >
          <IconTrash className="size-4" />
        </Button>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
          <IconPlus className="size-4" /> New credential
        </Button>
      </div>
      <DataTable
        columns={columns}
        rows={credentials.data?.data ?? []}
        loading={credentials.isLoading}
        empty="No S3 credentials yet. Create one to access the gateway."
      />

      <SimpleDialog
        title="Create S3 credential"
        description="Generates an access key pair for the S3-compatible gateway."
        open={creating}
        onOpenChange={setCreating}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
        >
          <form.AppField
            name="label"
            children={(field) => <field.TextField label="Label" placeholder="e.g. backup-script" />}
          />
          <Field className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isLoading}>
              {isLoading ? 'Creating…' : 'Create'}
            </Button>
          </Field>
        </form>
      </SimpleDialog>

      <SimpleDialog
        title="Credential created"
        description="Copy the secret key now — it will not be shown again."
        open={!!created}
        onOpenChange={(open) => !open && setCreated(null)}
      >
        {created && (
          <div className="flex flex-col gap-3">
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Access key ID</p>
              <div className="flex gap-2">
                <Input readOnly value={created.access_key_id} className="font-mono text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copy(created.access_key_id, 'Access key ID')}
                >
                  <IconCopy className="size-4" />
                </Button>
              </div>
            </div>
            {created.secret_key && (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Secret key</p>
                <div className="flex gap-2">
                  <Input readOnly value={created.secret_key} className="font-mono text-xs" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copy(created.secret_key!, 'Secret key')}
                  >
                    <IconCopy className="size-4" />
                  </Button>
                </div>
              </div>
            )}
            <Button variant="primary" onClick={() => setCreated(null)}>
              Done
            </Button>
          </div>
        )}
      </SimpleDialog>

      <SimpleAlertDialog
        open={!!revoking}
        onOpenChange={(open) => !open && setRevoking(null)}
        title="Revoke credential"
        description={`Revoke access key "${revoking?.access_key_id}"? Clients using it will lose access immediately.`}
        confirmText="Revoke"
        onConfirm={async () => {
          if (!revoking) return
          try {
            await revoke.mutateAsync(revoking.id)
            toast.success('Credential revoked')
            setRevoking(null)
          } catch (error) {
            toastError(error)
          }
        }}
      />
    </div>
  )
}

// ── Buckets tab ────────────────────────────────────────────────────────

function BucketDialog({
  wsId,
  open,
  onOpenChange,
}: {
  wsId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const accounts = useStorageAccounts(wsId, { limit: 100 })
  const create = useCreateS3Bucket(wsId)
  const [isLoading, setIsLoading] = useState(false)

  const accountOptions = (accounts.data?.data ?? [])
    .filter((a) => a.status === 'active')
    .map((a) => ({ label: a.display_name, value: a.id }))

  const form = useAppForm({
    defaultValues: {
      name: '',
      storage_account_id: '',
      root_prefix: '',
    },
    validators: {
      onSubmit: CreateS3BucketSchema,
    },
    onSubmit: async ({ value }) => {
      setIsLoading(true)
      try {
        await create.mutateAsync({
          name: value.name,
          storage_account_id: value.storage_account_id,
          ...(value.root_prefix ? { root_prefix: value.root_prefix } : {}),
        })
        toast.success('Bucket created')
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
      title="Create S3 bucket"
      description="Expose a prefix on a connected storage account through the S3 gateway."
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
          name="name"
          children={(field) => (
            <field.TextField label="Bucket name" placeholder="my-bucket" asterisk />
          )}
        />
        <form.AppField
          name="storage_account_id"
          children={(field) => (
            <field.SelectField
              label="Storage account"
              placeholder="Select account"
              options={accountOptions}
              loading={accounts.isLoading}
              asterisk
            />
          )}
        />
        <form.AppField
          name="root_prefix"
          children={(field) => (
            <field.TextField label="Root prefix" placeholder="Optional, e.g. backups/" />
          )}
        />
        <Field className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isLoading}>
            {isLoading ? 'Creating…' : 'Create'}
          </Button>
        </Field>
      </form>
    </SimpleDialog>
  )
}

function BucketsTab({ wsId }: { wsId: string }) {
  const buckets = useS3Buckets(wsId)
  const accounts = useStorageAccounts(wsId, { limit: 100 })
  const del = useDeleteS3Bucket(wsId)

  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Models.S3Bucket | null>(null)

  const accountName = (id: string) =>
    accounts.data?.data.find((a) => a.id === id)?.display_name ?? id

  const columns: DataTableColumn<Models.S3Bucket>[] = [
    { header: 'Name', cell: (b) => <span className="font-medium">{b.name}</span> },
    {
      header: 'Storage account',
      cell: (b) => (
        <span className="text-muted-foreground">{accountName(b.storage_account_id)}</span>
      ),
    },
    {
      header: 'Root prefix',
      cell: (b) => (
        <span className="font-mono text-xs text-muted-foreground">{b.root_prefix || '/'}</span>
      ),
    },
    {
      header: 'Created',
      cell: (b) => (
        <span className="text-muted-foreground">{new Date(b.created_at).toLocaleDateString()}</span>
      ),
    },
    {
      header: '',
      className: 'w-12 text-right',
      cell: (b) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8">
              <IconDotsVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem variant="destructive" onClick={() => setDeleting(b)}>
              <IconTrash className="size-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
          <IconPlus className="size-4" /> New bucket
        </Button>
      </div>
      <DataTable
        columns={columns}
        rows={buckets.data?.data ?? []}
        loading={buckets.isLoading}
        empty="No buckets yet."
      />

      <BucketDialog wsId={wsId} open={creating} onOpenChange={setCreating} />

      <SimpleAlertDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete bucket"
        description={`Delete bucket "${deleting?.name}"? Data in the underlying storage account is not removed.`}
        confirmText="Delete"
        onConfirm={async () => {
          if (!deleting) return
          try {
            await del.mutateAsync(deleting.id)
            toast.success('Bucket deleted')
            setDeleting(null)
          } catch (error) {
            toastError(error)
          }
        }}
      />
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────

export default function S3Page() {
  const [wsId] = useQueryState('ws')

  return (
    <SectionCard
      title="S3 Gateway"
      description="S3-compatible credentials and virtual buckets for the selected workspace."
      toolbar={<WorkspacePicker />}
    >
      {!wsId ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Select an organization and workspace to manage the S3 gateway.
        </p>
      ) : (
        <Tabs defaultValue="credentials">
          <TabsList className="mb-4">
            <TabsTrigger value="credentials">Credentials</TabsTrigger>
            <TabsTrigger value="buckets">Buckets</TabsTrigger>
          </TabsList>
          <TabsContent value="credentials">
            <CredentialsTab wsId={wsId} />
          </TabsContent>
          <TabsContent value="buckets">
            <BucketsTab wsId={wsId} />
          </TabsContent>
        </Tabs>
      )}
    </SectionCard>
  )
}
