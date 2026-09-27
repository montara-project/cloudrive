'use client'

import { IconDotsVertical, IconPlus, IconTrash } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import { AddWorkspaceForm } from '@/components/block/workspaces/form'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

import { features } from '../common/react-table'
import ReactTable from '../common/react-table'
import SimpleAlertDialog from '../common/simple-alert-dialog'

type ColumnType = ColumnDef<typeof features, Models.Workspace, unknown>

export default function WorkspacesTab({ orgId }: { orgId: string }) {
  const router = useRouter()
  const workspaces = useQuery(
    queries.workspaces.list(orgId, { limit: 100, order_by: 'created_at', order: 'desc' })
  )
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Models.Workspace | null>(null)
  const del = useMutation(queries.workspaces.delete())

  const isLoading = workspaces.isLoading || workspaces.isFetching || workspaces.isPending

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
        accessorKey: 'slug',
        header: 'Slug',
        cell: (info) => {
          const value = info.getValue() as string
          return isLoading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <span className="text-muted-foreground">{value}</span>
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
          const w = row.original
          return isLoading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="size-8">
                  <IconDotsVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  variant="destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeleting(w)
                  }}
                >
                  <IconTrash className="size-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ]
  }, [isLoading])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
          <IconPlus className="size-4" /> New workspace
        </Button>
      </div>
      <ReactTable
        columns={columns}
        data={workspaces.data?.data ?? []}
        total={workspaces.data?.metadata?.total ?? workspaces.data?.data?.length ?? 0}
        pageSize={100}
        empty="No workspaces yet."
        onRowClick={(w) => router.push(`/workspaces/${w.id}`)}
      />

      <AddWorkspaceForm orgId={orgId} open={creating} onOpenChange={setCreating} />

      <SimpleAlertDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete workspace"
        description={`Delete "${deleting?.name}"? Its storage accounts and S3 gateway config will be removed.`}
        confirmText="Delete"
        onConfirm={async () => {
          if (!deleting) return
          try {
            await del.mutateAsync(deleting.id)
            toast.success('Workspace deleted')
            setDeleting(null)
          } catch (error) {
            toastAxiosError(error)
          }
        }}
      />
    </div>
  )
}
