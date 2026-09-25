'use client'

import { IconCopy, IconPlus, IconTrash } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppForm } from '@/hooks/form'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

import { features } from '../common/react-table'
import ReactTable from '../common/react-table'
import SimpleAlertDialog from '../common/simple-alert-dialog'
import SimpleDialog from '../common/simple-dialog'
import StatusBadge from '../common/status-badge'

type ColumnType = ColumnDef<typeof features, Models.S3Credential, unknown>

export default function CredentialsTab({ wsId }: { wsId: string }) {
  const credentials = useQuery(queries.s3.credentials.list(wsId))
  const create = useMutation(queries.s3.credentials.create(wsId))
  const revoke = useMutation(queries.s3.credentials.revoke(wsId))

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
        setCreated(cred.data)
      } catch (error) {
        toastAxiosError(error)
      } finally {
        setIsLoading(false)
      }
    },
  })

  const copy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text)
    toast.success(`${label} copied`)
  }

  const isTableLoading = credentials.isLoading || credentials.isFetching || credentials.isPending

  const columns = useMemo<ColumnType[]>(() => {
    return [
      {
        accessorKey: 'access_key_id',
        header: 'Access key ID',
        cell: (info) => {
          const value = info.getValue() as string
          return isTableLoading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <span className="font-mono text-xs">{value}</span>
          )
        },
      },
      {
        accessorKey: 'label',
        header: 'Label',
        cell: (info) => {
          const value = info.getValue() as string
          return isTableLoading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <span className="text-muted-foreground">{value || '—'}</span>
          )
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const c = row.original
          return isTableLoading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <StatusBadge value={c.status} />
          )
        },
      },
      {
        accessorKey: 'last_used_at',
        header: 'Last used',
        cell: (info) => {
          const value = info.getValue() as string | null
          return isTableLoading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <span className="text-muted-foreground">
              {value ? new Date(value).toLocaleString() : 'Never'}
            </span>
          )
        },
      },
      {
        accessorKey: 'created_at',
        header: 'Created',
        cell: (info) => {
          const value = info.getValue() as string
          return isTableLoading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <span className="text-muted-foreground">
              {value ? new Date(value).toLocaleDateString() : '—'}
            </span>
          )
        },
      },
      {
        id: 'actions',
        header: '',
        size: 50,
        meta: { cellClassName: 'w-12 text-right' },
        cell: ({ row }) => {
          const c = row.original
          return isTableLoading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-destructive"
              onClick={() => setRevoking(c)}
            >
              <IconTrash className="size-4" />
            </Button>
          )
        },
      },
    ]
  }, [isTableLoading])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
          <IconPlus className="size-4" /> New credential
        </Button>
      </div>
      <ReactTable
        columns={columns}
        data={credentials.data?.data ?? []}
        total={credentials.data?.metadata?.total ?? credentials.data?.data?.length ?? 0}
        pageSize={100}
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
            toastAxiosError(error)
          }
        }}
      />
    </div>
  )
}
