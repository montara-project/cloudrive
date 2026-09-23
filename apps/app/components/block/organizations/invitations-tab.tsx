'use client'

import { IconMail, IconTrash } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppForm } from '@/hooks/form'
import { toastAxiosError } from '@/lib/api/axios-error'
import {
  CreateInvitationSchema,
  type CreateInvitationDto,
} from '@/lib/api/dtos/organization/schema'
import { queries } from '@/lib/api/queries'

import { features } from '../common/react-table'
import ReactTable from '../common/react-table'
import SimpleAlertDialog from '../common/simple-alert-dialog'
import SimpleDialog from '../common/simple-dialog'
import StatusBadge from '../common/status-badge'

type ColumnType = ColumnDef<typeof features, Models.OrganizationInvitation, unknown>

function InvitationDialog({
  orgId,
  open,
  onOpenChange,
}: {
  orgId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const create = useMutation(queries.organizations.invitations.create(orgId))
  const [isLoading, setIsLoading] = useState(false)

  const form = useAppForm({
    defaultValues: {
      email: '',
      role: 'member' as 'admin' | 'member',
    } satisfies CreateInvitationDto,
    validators: {
      onSubmit: CreateInvitationSchema,
    },
    onSubmit: async ({ value }) => {
      setIsLoading(true)
      try {
        await create.mutateAsync({ email: value.email, role: value.role })
        toast.success(`Invitation sent to ${value.email}`)
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
      title="Invite member"
      description="They'll receive an email with a link to join this organization."
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
          name="email"
          children={(field) => (
            <field.TextField label="Email" placeholder="teammate@example.com" asterisk />
          )}
        />
        <form.AppField
          name="role"
          children={(field) => (
            <field.SelectField
              label="Role"
              options={[
                { label: 'Member', value: 'member' },
                { label: 'Admin', value: 'admin' },
              ]}
              asterisk
            />
          )}
        />
        <Field className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isLoading}>
            {isLoading ? 'Sending…' : 'Send invitation'}
          </Button>
        </Field>
      </form>
    </SimpleDialog>
  )
}

export default function InvitationsTab({ orgId }: { orgId: string }) {
  const invitations = useQuery(
    queries.organizations.invitations.list(orgId, {
      limit: 100,
      order_by: 'created_at',
      order: 'desc',
    })
  )
  const [creating, setCreating] = useState(false)
  const [revoking, setRevoking] = useState<Models.OrganizationInvitation | null>(null)
  const del = useMutation(queries.organizations.invitations.delete(orgId))

  const isLoading = invitations.isLoading || invitations.isFetching || invitations.isPending

  const columns = useMemo<ColumnType[]>(() => {
    return [
      {
        accessorKey: 'email',
        header: 'Email',
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
        accessorKey: 'role',
        header: 'Role',
        cell: (info) => {
          const value = info.getValue() as string
          return isLoading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <span className="capitalize">{value}</span>
          )
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const i = row.original
          return isLoading ? <Skeleton className="h-5 w-full" /> : <StatusBadge value={i.status} />
        },
      },
      {
        accessorKey: 'expires_at',
        header: 'Expires',
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
          const i = row.original
          return isLoading ? (
            <Skeleton className="h-5 w-full" />
          ) : i.status === 'pending' ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-destructive"
              onClick={() => setRevoking(i)}
            >
              <IconTrash className="size-4" />
            </Button>
          ) : null
        },
      },
    ]
  }, [isLoading])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
          <IconMail className="size-4" /> Invite member
        </Button>
      </div>
      <ReactTable
        columns={columns}
        data={invitations.data?.data ?? []}
        total={invitations.data?.metadata?.total ?? invitations.data?.data?.length ?? 0}
        pageSize={100}
        empty="No invitations sent."
      />

      <InvitationDialog orgId={orgId} open={creating} onOpenChange={setCreating} />

      <SimpleAlertDialog
        open={!!revoking}
        onOpenChange={(open) => !open && setRevoking(null)}
        title="Revoke invitation"
        description={`Revoke the invitation sent to ${revoking?.email}?`}
        confirmText="Revoke"
        onConfirm={async () => {
          if (!revoking) return
          try {
            await del.mutateAsync(revoking.id)
            toast.success('Invitation revoked')
            setRevoking(null)
          } catch (error) {
            toastAxiosError(error)
          }
        }}
      />
    </div>
  )
}
