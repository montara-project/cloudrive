'use client'

import { IconDotsVertical, IconPlus, IconTrash } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import DataTable, { type DataTableColumn } from '@/components/block/common/data-table'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import WorkspaceDialog from '@/components/block/workspaces/workspace-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

export default function WorkspacesTab({ orgId }: { orgId: string }) {
  const router = useRouter()
  const workspaces = useQuery(
    queries.workspaces.list(orgId, { limit: 100, order_by: 'created_at', order: 'desc' })
  )
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Models.Workspace | null>(null)
  const del = useMutation(queries.workspaces.delete())

  const columns: DataTableColumn<Models.Workspace>[] = [
    {
      header: 'Name',
      cell: (w) => <span className="font-medium">{w.name}</span>,
    },
    {
      header: 'Slug',
      cell: (w) => <span className="text-muted-foreground">{w.slug}</span>,
    },
    {
      header: 'Created',
      cell: (w) => (
        <span className="text-muted-foreground">{new Date(w.created_at).toLocaleDateString()}</span>
      ),
    },
    {
      header: '',
      className: 'w-12 text-right',
      cell: (w) => (
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
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
          <IconPlus className="size-4" /> New workspace
        </Button>
      </div>
      <DataTable
        columns={columns}
        rows={workspaces.data?.data ?? []}
        loading={workspaces.isLoading}
        empty="No workspaces yet."
        onRowClick={(w) => router.push(`/workspaces/${w.id}`)}
      />

      <WorkspaceDialog orgId={orgId} open={creating} onOpenChange={setCreating} />

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
