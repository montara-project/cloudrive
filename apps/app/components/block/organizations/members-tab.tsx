'use client'

import { IconPlus, IconTrash } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

import MemberDialog from '../common/member-dialog'
import { features } from '../common/react-table'
import ReactTable from '../common/react-table'
import SimpleAlertDialog from '../common/simple-alert-dialog'

type ColumnType = ColumnDef<typeof features, Models.OrganizationMember, unknown>

export default function MembersTab({ orgId }: { orgId: string }) {
  const members = useQuery(queries.organizations.members.list(orgId, { limit: 100 }))
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<Models.OrganizationMember | null>(null)
  const add = useMutation(queries.organizations.members.add(orgId))
  const updateRole = useMutation(queries.organizations.members.update(orgId))
  const remove = useMutation(queries.organizations.members.remove(orgId))

  const isLoading = members.isLoading || members.isFetching || members.isPending

  const columns = useMemo<ColumnType[]>(() => {
    return [
      {
        accessorKey: 'user_id',
        header: 'User',
        cell: (info) => {
          const value = info.getValue() as string
          return isLoading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <span className="font-mono text-xs">{value}</span>
          )
        },
      },
      {
        accessorKey: 'role',
        header: 'Role',
        cell: ({ row }) => {
          const m = row.original
          return isLoading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
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
          )
        },
      },
      {
        accessorKey: 'created_at',
        header: 'Joined',
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
          const m = row.original
          return isLoading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-destructive"
              onClick={() => setRemoving(m)}
            >
              <IconTrash className="size-4" />
            </Button>
          )
        },
      },
    ]
  }, [isLoading, updateRole])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="primary" size="sm" onClick={() => setAdding(true)}>
          <IconPlus className="size-4" /> Add member
        </Button>
      </div>
      <ReactTable
        columns={columns}
        data={members.data?.data ?? []}
        total={members.data?.metadata?.total ?? members.data?.data?.length ?? 0}
        pageSize={100}
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
