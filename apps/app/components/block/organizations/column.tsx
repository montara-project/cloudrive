'use client'

import { useMutation } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
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
import { EditOrganizationForm } from './form'

type ColumnType = ColumnDef<typeof features, Models.Organization, unknown>

export function OrganizationColumn({ loading }: BaseColumnProps) {
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
  record: Models.Organization
}

function ActionCell({ record }: ActionCellProps) {
  const [openEdit, setOpenEdit] = useState(false)
  const [openDelete, setOpenDelete] = useState(false)

  const mutation = useMutation(queries.organizations.delete())

  const handleDelete = async () => {
    try {
      await mutation.mutateAsync(record.id)
      toast.success('Organization deleted')
    } catch (error) {
      toastAxiosError(error)
    }
  }

  return (
    <React.Fragment>
      <RowColumnAction onEdit={() => setOpenEdit(true)} onDelete={() => setOpenDelete(true)} />

      <SimpleAlertDialog
        title="Do you want to delete this chain?"
        description="This chain will be permanently deleted and cannot be undone."
        open={openDelete}
        onOpenChange={setOpenDelete}
        onConfirm={handleDelete}
        confirmText="Delete"
        variant="destructive"
      />

      <EditOrganizationForm open={openEdit} onOpenChange={setOpenEdit} record={record} />
    </React.Fragment>
  )
}
