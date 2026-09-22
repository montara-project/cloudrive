'use client'

import { IconKey, IconTrash } from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import React, { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { toastAxiosError } from '@/lib/api/axios-error'
import { Models } from '@/lib/api/models'
import { queries } from '@/lib/api/queries'
import { BaseColumnProps } from '@/types/column'

import { features } from '../common/react-table'
import RowColumnAction from '../common/row-column-action'
import SimpleAlertDialog from '../common/simple-alert-dialog'
import StatusBadge from '../common/status-badge'
import { EditStorageAccountForm, RotateCredentialsForm } from './form'

type ColumnType = ColumnDef<typeof features, Models.StorageAccount, unknown>

export function StorageAccountColumn({ loading, wsId }: BaseColumnProps & { wsId: string }) {
  const columns = useMemo<ColumnType[]>(() => {
    return [
      {
        accessorKey: 'display_name',
        header: 'Name',
        cell: (info) => {
          const value = info.getValue() as string
          return loading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <span className="font-medium">{value}</span>
          )
        },
      },
      {
        accessorKey: 'external_account_id',
        header: 'Provider account',
        cell: (info) => {
          const value = info.getValue() as string
          return loading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <span className="font-mono text-xs text-muted-foreground">{value}</span>
          )
        },
      },
      {
        accessorKey: 'account_email',
        header: 'Email',
        cell: (info) => {
          const value = info.getValue() as string
          return loading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <span className="text-muted-foreground">{value || '—'}</span>
          )
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: (info) => {
          const value = info.getValue() as string
          return loading ? <Skeleton className="h-5 w-full" /> : <StatusBadge value={value} />
        },
      },
      {
        accessorKey: 'last_synced_at',
        header: 'Last synced',
        cell: (info) => {
          const value = info.getValue() as string | null | undefined
          return loading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <span className="text-muted-foreground">
              {value ? new Date(value).toLocaleString() : 'Never'}
            </span>
          )
        },
      },
      {
        accessorKey: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          return loading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <ActionCell record={row.original} wsId={wsId} />
          )
        },
        size: 50,
      },
    ]
  }, [loading, wsId])

  return columns
}

interface ActionCellProps {
  record: Models.StorageAccount
  wsId: string
}

function ActionCell({ record, wsId }: ActionCellProps) {
  const [openEdit, setOpenEdit] = useState(false)
  const [openRotate, setOpenRotate] = useState(false)
  const [openDisconnect, setOpenDisconnect] = useState(false)

  const mutation = useMutation(queries.storageAccounts.disconnect(wsId))

  const handleDisconnect = async () => {
    try {
      await mutation.mutateAsync(record.id)
      toast.success('Storage account disconnected')
    } catch (error) {
      toastAxiosError(error)
    }
  }

  return (
    <React.Fragment>
      <RowColumnAction
        onEdit={() => setOpenEdit(true)}
        dropdown={
          <React.Fragment>
            <DropdownMenuItem onClick={() => setOpenRotate(true)}>
              <IconKey /> Rotate credentials
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => setOpenDisconnect(true)}>
              <IconTrash /> Disconnect
            </DropdownMenuItem>
          </React.Fragment>
        }
      />

      <SimpleAlertDialog
        title="Disconnect storage account"
        description={`Disconnect "${record.display_name}"? Buckets backed by this account will stop working.`}
        open={openDisconnect}
        onOpenChange={setOpenDisconnect}
        onConfirm={handleDisconnect}
        confirmText="Disconnect"
        variant="destructive"
      />

      <EditStorageAccountForm
        wsId={wsId}
        open={openEdit}
        onOpenChange={setOpenEdit}
        record={record}
      />

      <RotateCredentialsForm
        wsId={wsId}
        open={openRotate}
        onOpenChange={setOpenRotate}
        record={record}
      />
    </React.Fragment>
  )
}
