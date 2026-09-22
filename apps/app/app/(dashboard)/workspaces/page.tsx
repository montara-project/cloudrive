'use client'

import { IconDotsVertical, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useQueryState } from 'nuqs'
import { useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import DataTable, { type DataTableColumn } from '@/components/block/common/data-table'
import SectionCard from '@/components/block/common/section-card'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import WorkspaceDialog from '@/components/block/workspaces/workspace-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

type Workspace = Models.Workspace

export default function WorkspacesPage() {
  const router = useRouter()
  const [orgId, setOrgId] = useQueryState('org')

  const orgs = useQuery(queries.organizations.list({ limit: 100 }))
  const workspaces = useQuery(
    queries.workspaces.list(orgId ?? '', {
      limit: 100,
      order_by: 'created_at',
      order: 'desc',
    })
  )

  const [dialog, setDialog] = useState<{ open: boolean; ws: Workspace | null }>({
    open: false,
    ws: null,
  })
  const [deleting, setDeleting] = useState<Workspace | null>(null)
  const del = useMutation(queries.workspaces.delete())

  const columns: DataTableColumn<Workspace>[] = [
    {
      header: 'Name',
      cell: (w) => <span className="font-medium">{w.name}</span>,
    },
    {
      header: 'Slug',
      cell: (w) => <span className="text-muted-foreground">{w.slug}</span>,
    },
    {
      header: 'Description',
      cell: (w) => (
        <span className="line-clamp-1 max-w-64 text-muted-foreground">{w.description || '—'}</span>
      ),
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
              onClick={(e) => {
                e.stopPropagation()
                setDialog({ open: true, ws: w })
              }}
            >
              <IconPencil className="size-4" /> Edit
            </DropdownMenuItem>
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
    <>
      <SectionCard
        title="Workspaces"
        description="Workspaces inside the selected organization."
        toolbar={
          <div className="flex items-center gap-2">
            <Select value={orgId ?? ''} onValueChange={setOrgId}>
              <SelectTrigger className="h-9 min-w-44">
                <SelectValue placeholder={orgs.isLoading ? 'Loading…' : 'Select organization'} />
              </SelectTrigger>
              <SelectContent>
                {(orgs.data?.data ?? []).map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="primary"
              size="sm"
              disabled={!orgId}
              onClick={() => setDialog({ open: true, ws: null })}
            >
              <IconPlus className="size-4" /> New workspace
            </Button>
          </div>
        }
      >
        {!orgId ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Select an organization to see its workspaces.
          </p>
        ) : (
          <DataTable
            columns={columns}
            rows={workspaces.data?.data ?? []}
            loading={workspaces.isLoading}
            empty="No workspaces in this organization yet."
            onRowClick={(w) => router.push(`/workspaces/${w.id}`)}
          />
        )}
      </SectionCard>

      <WorkspaceDialog
        key={dialog.ws?.id ?? 'new'}
        orgId={orgId ?? undefined}
        workspace={dialog.ws}
        open={dialog.open}
        onOpenChange={(open) => setDialog({ open, ws: open ? dialog.ws : null })}
      />

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
    </>
  )
}
