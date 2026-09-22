'use client'

import { IconPlus, IconTrash } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import DataTable, { type DataTableColumn } from '@/components/block/common/data-table'
import MemberDialog from '@/components/block/common/member-dialog'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import { Button } from '@/components/ui/button'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

export default function MembersTab({ orgId }: { orgId: string }) {
  const members = useQuery(queries.organizations.members.list(orgId, { limit: 100 }))
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<Models.OrganizationMember | null>(null)
  const add = useMutation(queries.organizations.members.add(orgId))
  const updateRole = useMutation(queries.organizations.members.update(orgId))
  const remove = useMutation(queries.organizations.members.remove(orgId))

  const columns: DataTableColumn<Models.OrganizationMember>[] = [
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
          onChange={async (e) => {
            try {
              await updateRole.mutateAsync({ userId: m.user_id, role: e.target.value })
              toast.success('Role updated')
            } catch (error) {
              toastAxiosError(error)
            }
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {['owner', 'admin', 'member'].map((r) => (
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
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-destructive"
          onClick={() => setRemoving(m)}
        >
          <IconTrash className="size-4" />
        </Button>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="primary" size="sm" onClick={() => setAdding(true)}>
          <IconPlus className="size-4" /> Add member
        </Button>
      </div>
      <DataTable
        columns={columns}
        rows={members.data?.data ?? []}
        loading={members.isLoading}
        empty="No members yet."
      />

      <MemberDialog
        open={adding}
        onOpenChange={setAdding}
        title="Add member"
        roles={[
          { value: 'admin', label: 'Admin' },
          { value: 'member', label: 'Member' },
        ]}
        onSubmit={(body) => add.mutateAsync(body)}
      />

      <SimpleAlertDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Remove member"
        description="Remove this member from the organization? They lose access to all workspaces."
        confirmText="Remove"
        onConfirm={async () => {
          if (!removing) return
          try {
            await remove.mutateAsync(removing.user_id)
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
