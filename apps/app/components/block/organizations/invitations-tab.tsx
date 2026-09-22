'use client'

import { IconMail, IconTrash } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import DataTable, { type DataTableColumn } from '@/components/block/common/data-table'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import SimpleDialog from '@/components/block/common/simple-dialog'
import StatusBadge from '@/components/block/common/status-badge'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { useAppForm } from '@/hooks/form'
import { toastAxiosError } from '@/lib/api/axios-error'
import {
  CreateInvitationSchema,
  type CreateInvitationDto,
} from '@/lib/api/dtos/organization/schema'
import { queries } from '@/lib/api/queries'

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

  const columns: DataTableColumn<Models.OrganizationInvitation>[] = [
    {
      header: 'Email',
      cell: (i) => <span className="font-medium">{i.email}</span>,
    },
    { header: 'Role', cell: (i) => <span className="capitalize">{i.role}</span> },
    { header: 'Status', cell: (i) => <StatusBadge value={i.status} /> },
    {
      header: 'Expires',
      cell: (i) => (
        <span className="text-muted-foreground">{new Date(i.expires_at).toLocaleDateString()}</span>
      ),
    },
    {
      header: '',
      className: 'w-12 text-right',
      cell: (i) =>
        i.status === 'pending' ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-destructive"
            onClick={() => setRevoking(i)}
          >
            <IconTrash className="size-4" />
          </Button>
        ) : null,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
          <IconMail className="size-4" /> Invite member
        </Button>
      </div>
      <DataTable
        columns={columns}
        rows={invitations.data?.data ?? []}
        loading={invitations.isLoading}
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
