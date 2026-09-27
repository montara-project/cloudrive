'use client'

import { useMutation } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { useRouter } from 'next/navigation'
import React, { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Skeleton } from '@/components/ui/skeleton'
import { toastAxiosError } from '@/lib/api/axios-error'
import { Models } from '@/lib/api/models'
import { queries } from '@/lib/api/queries'
import { BaseColumnProps } from '@/types/column'

import { features } from '../common/react-table'
import RowColumnAction from '../common/row-column-action'
import SimpleAlertDialog from '../common/simple-alert-dialog'
import { EditWorkspaceForm } from './form'

type ColumnType = ColumnDef<typeof features, Models.Workspace, unknown>

export function WorkspaceColumn({ loading }: BaseColumnProps) {
  const columns = useMemo<ColumnType[]>(() => {
    return [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: (info) => {
          const value = info.getValue() as string
          return loading ? <Skeleton className="h-5 w-full" /> : <span>{value}</span>
        },
      },
      {
        accessorKey: 'slug',
        header: 'Slug',
        cell: (info) => {
          const value = info.getValue() as string
          return loading ? <Skeleton className="h-5 w-full" /> : <span>{value}</span>
        },
      },
      {
        accessorKey: 'description',
        header: 'Description',
        cell: (info) => {
          const value = info.getValue() as string
          return loading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <span className="line-clamp-1 max-w-64 text-muted-foreground">{value || '—'}</span>
          )
        },
      },
      {
        accessorKey: 'created_at',
        header: 'Created At',
        cell: (info) => {
          const value = info.getValue() as string
          return loading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <span>{value ? new Date(value).toLocaleDateString() : '—'}</span>
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
            <ActionCell record={row.original} />
          )
        },
        size: 50,
      },
    ]
  }, [loading])

  return columns
}

interface ActionCellProps {
  record: Models.Workspace
}

function ActionCell({ record }: ActionCellProps) {
  const router = useRouter()
  const [openEdit, setOpenEdit] = useState(false)
  const [openDelete, setOpenDelete] = useState(false)

  const mutation = useMutation(queries.workspaces.delete())

  const handleDelete = async () => {
    try {
      await mutation.mutateAsync(record.id)
      toast.success('Workspace deleted')
    } catch (error) {
      toastAxiosError(error)
    }
  }

  return (
    <React.Fragment>
      <RowColumnAction
        onShow={() => router.push(`/workspaces/${record.id}`)}
        onEdit={() => setOpenEdit(true)}
        onDelete={() => setOpenDelete(true)}
      />

      <SimpleAlertDialog
        title="Delete workspace"
        description={`Delete "${record.name}"? Its storage accounts and S3 gateway config will be removed.`}
        open={openDelete}
        onOpenChange={setOpenDelete}
        onConfirm={handleDelete}
        confirmText="Delete"
        variant="destructive"
      />

      <EditWorkspaceForm open={openEdit} onOpenChange={setOpenEdit} record={record} />
    </React.Fragment>
  )
}
