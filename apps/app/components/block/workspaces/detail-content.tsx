'use client'

import { IconArrowLeft, IconDotsVertical, IconPlus, IconTrash } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import DataTable, { type DataTableColumn } from '@/components/block/common/data-table'
import MemberDialog from '@/components/block/common/member-dialog'
import SectionCard from '@/components/block/common/section-card'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

import { EditWorkspaceForm } from './form'

export default function WorkspaceDetailContent({ wsId }: { wsId: string }) {
  const router = useRouter()

  const workspace = useQuery(queries.workspaces.get({ id: wsId }))
  const members = useQuery(queries.workspaces.members.list(wsId, { limit: 100 }))

  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [addingMember, setAddingMember] = useState(false)
  const [removing, setRemoving] = useState<Models.WorkspaceMember | null>(null)

  const del = useMutation(queries.workspaces.delete())
  const addMember = useMutation(queries.workspaces.members.add(wsId))
  const updateRole = useMutation(queries.workspaces.members.update(wsId))
  const removeMember = useMutation(queries.workspaces.members.remove(wsId))

  if (workspace.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <span className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (workspace.isError || !workspace.data) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <p className="text-muted-foreground">Workspace not found or unavailable.</p>
        <Button variant="outline" onClick={() => router.push('/workspaces')}>
          <IconArrowLeft className="size-4" /> Back to workspaces
        </Button>
      </div>
    )
  }

  const ws = workspace.data.data
  const memberColumns: DataTableColumn<Models.WorkspaceMember>[] = [
    {
      header: 'User',
      cell: (m) => <span className="font-mono text-xs">{m.user_id}</span>,
    },
    {
      header: 'Role',
      cell: (m) => (
        <select
          className="h-8 rounded-md border border-border bg-background px-2 text-sm capitalize"
          value={m.role}
          onClick={(e) => e.stopPropagation()}
          onChange={async (e) => {
            try {
              await updateRole.mutateAsync({ userId: m.user_id, role: e.target.value })
              toast.success('Role updated')
            } catch (error) {
              toastAxiosError(error)
            }
          }}
        >
          {['admin', 'member', 'viewer'].map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      ),
    },
    {
      header: 'Joined',
      cell: (m) => (
        <span className="text-muted-foreground">{new Date(m.created_at).toLocaleDateString()}</span>
      ),
    },
    {
      header: '',
      className: 'w-12 text-right',
      cell: (m) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8">
              <IconDotsVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem variant="destructive" onClick={() => setRemoving(m)}>
              <IconTrash className="size-4" /> Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="size-8" asChild>
            <Link href="/workspaces">
              <IconArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{ws.name}</h1>
            <p className="text-sm text-muted-foreground">
              {ws.slug}
              {ws.description ? ` · ${ws.description}` : ''}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setDeleting(true)}>
            <IconTrash className="size-4" /> Delete
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/storage?org=${ws.organization_id}&ws=${ws.id}`}>Storage accounts</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/s3?org=${ws.organization_id}&ws=${ws.id}`}>S3 gateway</Link>
        </Button>
      </div>

      <SectionCard
        title="Members"
        description="People with access to this workspace."
        toolbar={
          <Button variant="primary" size="sm" onClick={() => setAddingMember(true)}>
            <IconPlus className="size-4" /> Add member
          </Button>
        }
      >
        <DataTable
          columns={memberColumns}
          rows={members.data?.data ?? []}
          loading={members.isLoading}
          empty="No members yet."
        />
      </SectionCard>

      <EditWorkspaceForm open={editing} onOpenChange={setEditing} record={ws} />

      <MemberDialog
        open={addingMember}
        onOpenChange={setAddingMember}
        title="Add member"
        roles={[
          { value: 'admin', label: 'Admin' },
          { value: 'member', label: 'Member' },
          { value: 'viewer', label: 'Viewer' },
        ]}
        onSubmit={(body) => addMember.mutateAsync(body)}
      />

      <SimpleAlertDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete workspace"
        description={`Delete "${ws.name}"? Its storage accounts and S3 gateway config will be removed.`}
        confirmText="Delete"
        onConfirm={async () => {
          try {
            await del.mutateAsync(wsId)
            toast.success('Workspace deleted')
            router.push('/workspaces')
          } catch (error) {
            toastAxiosError(error)
          }
        }}
      />

      <SimpleAlertDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Remove member"
        description="Remove this member from the workspace?"
        confirmText="Remove"
        onConfirm={async () => {
          if (!removing) return
          try {
            await removeMember.mutateAsync(removing.user_id)
            toast.success('Member removed')
            setRemoving(null)
          } catch (error) {
            toastAxiosError(error)
          }
        }}
      />
    </div>
  )
}
