'use client'

import { IconDotsVertical, IconPlus, IconTrash } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Field } from '@/components/ui/field'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppForm } from '@/hooks/form'
import { toastAxiosError } from '@/lib/api/axios-error'
import { CreateS3BucketSchema } from '@/lib/api/dtos/s3/schema'
import { queries } from '@/lib/api/queries'

import { features } from '../common/react-table'
import ReactTable from '../common/react-table'
import SimpleAlertDialog from '../common/simple-alert-dialog'
import SimpleDialog from '../common/simple-dialog'

type ColumnType = ColumnDef<typeof features, Models.S3Bucket, unknown>

function BucketDialog({
  wsId,
  open,
  onOpenChange,
}: {
  wsId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const accounts = useQuery(queries.storageAccounts.list(wsId, { limit: 100 }))
  const create = useMutation(queries.s3.buckets.create(wsId))
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
        toastAxiosError(error)
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

export default function BucketsTab({ wsId }: { wsId: string }) {
  const buckets = useQuery(queries.s3.buckets.list(wsId))
  const accounts = useQuery(queries.storageAccounts.list(wsId, { limit: 100 }))
  const del = useMutation(queries.s3.buckets.delete(wsId))

  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Models.S3Bucket | null>(null)

  const isLoading = buckets.isLoading || buckets.isFetching || buckets.isPending

  const columns = useMemo<ColumnType[]>(() => {
    return [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: (info) => {
          const value = info.getValue() as string
          return isLoading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <span className="font-medium">{value}</span>
          )
        },
      },
      {
        accessorKey: 'storage_account_id',
        header: 'Storage account',
        cell: ({ row }) => {
          const b = row.original
          const displayName =
            accounts.data?.data.find((a) => a.id === b.storage_account_id)?.display_name ??
            b.storage_account_id
          return isLoading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <span className="text-muted-foreground">{displayName}</span>
          )
        },
      },
      {
        accessorKey: 'root_prefix',
        header: 'Root prefix',
        cell: (info) => {
          const value = info.getValue() as string
          return isLoading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <span className="font-mono text-xs text-muted-foreground">{value || '/'}</span>
          )
        },
      },
      {
        accessorKey: 'created_at',
        header: 'Created',
        cell: (info) => {
          const value = info.getValue() as string
          return isLoading ? (
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
          const b = row.original
          return isLoading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
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
          )
        },
      },
    ]
  }, [isLoading, accounts.data])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
          <IconPlus className="size-4" /> New bucket
        </Button>
      </div>
      <ReactTable
        columns={columns}
        data={buckets.data?.data ?? []}
        total={buckets.data?.metadata?.total ?? buckets.data?.data?.length ?? 0}
        pageSize={100}
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
            toastAxiosError(error)
          }
        }}
      />
    </div>
  )
}
