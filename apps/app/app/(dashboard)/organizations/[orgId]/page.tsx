'use client'

import { IconArrowLeft, IconDotsVertical, IconMail, IconPlus, IconTrash } from '@tabler/icons-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import DataTable, { type DataTableColumn } from '@/components/block/common/data-table'
import MemberDialog from '@/components/block/common/member-dialog'
import SectionCard from '@/components/block/common/section-card'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import SimpleDialog from '@/components/block/common/simple-dialog'
import StatusBadge from '@/components/block/common/status-badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Field } from '@/components/ui/field'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAppForm } from '@/hooks/form'
import { throwAxiosError } from '@/lib/api/axios-error'
import {
  CreateInvitationSchema,
  type CreateInvitationDto,
} from '@/lib/api/dtos/organization/schema'
import { CreateWorkspaceSchema, type CreateWorkspaceDto } from '@/lib/api/dtos/workspace/schema'
import {
  useAddOrganizationMember,
  useCreateInvitation,
  useCreateWorkspace,
  useDeleteInvitation,
  useDeleteOrganization,
  useDeleteWorkspace,
  useOrganization,
  useOrganizationInvitations,
  useOrganizationMembers,
  useRemoveOrganizationMember,
  useUpdateOrganizationMemberRole,
  useWorkspaces,
} from '@/lib/api/queries'

function toastError(error: unknown) {
  try {
    throwAxiosError(error as Error)
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'An error occurred')
  }
}

// ── Workspaces tab ─────────────────────────────────────────────────────

function WorkspaceDialog({
  orgId,
  open,
  onOpenChange,
}: {
  orgId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const create = useCreateWorkspace(orgId)
  const [isLoading, setIsLoading] = useState(false)

  const form = useAppForm({
    defaultValues: {
      name: '',
      slug: '',
      description: '',
    } satisfies CreateWorkspaceDto,
    validators: {
      onSubmit: CreateWorkspaceSchema,
    },
    onSubmit: async ({ value }) => {
      setIsLoading(true)
      try {
        await create.mutateAsync({
          name: value.name,
          slug: value.slug,
          ...(value.description ? { description: value.description } : {}),
        })
        toast.success('Workspace created')
        onOpenChange(false)
      } catch (error) {
        toastError(error)
      } finally {
        setIsLoading(false)
      }
    },
  })

  return (
    <SimpleDialog
      title="Create workspace"
      description="Workspaces hold storage accounts and S3 gateways."
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
          name="name"
          children={(field) => <field.TextField label="Name" placeholder="Production" asterisk />}
        />
        <form.AppField
          name="slug"
          children={(field) => <field.TextField label="Slug" placeholder="production" asterisk />}
        />
        <form.AppField
          name="description"
          children={(field) => <field.TextareaField label="Description" placeholder="Optional" />}
        />
        <Field className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isLoading}>
            {isLoading ? 'Creating…' : 'Create'}
          </Button>
        </Field>
      </form>
    </SimpleDialog>
  )
}

function WorkspacesTab({ orgId }: { orgId: string }) {
  const router = useRouter()
  const workspaces = useWorkspaces(orgId, { limit: 100, order_by: 'created_at', order: 'desc' })
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Models.Workspace | null>(null)
  const del = useDeleteWorkspace()

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
            toastError(error)
          }
        }}
      />
    </div>
  )
}

// ── Members tab ────────────────────────────────────────────────────────

function MembersTab({ orgId }: { orgId: string }) {
  const members = useOrganizationMembers(orgId, { limit: 100 })
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<Models.OrganizationMember | null>(null)
  const add = useAddOrganizationMember(orgId)
  const updateRole = useUpdateOrganizationMemberRole(orgId)
  const remove = useRemoveOrganizationMember(orgId)

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
              toastError(error)
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
            toastError(error)
          }
        }}
      />
    </div>
  )
}

// ── Invitations tab ────────────────────────────────────────────────────

function InvitationDialog({
  orgId,
  open,
  onOpenChange,
}: {
  orgId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const create = useCreateInvitation(orgId)
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
        toastError(error)
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

function InvitationsTab({ orgId }: { orgId: string }) {
  const invitations = useOrganizationInvitations(orgId, {
    limit: 100,
    order_by: 'created_at',
    order: 'desc',
  })
  const [creating, setCreating] = useState(false)
  const [revoking, setRevoking] = useState<Models.OrganizationInvitation | null>(null)
  const del = useDeleteInvitation(orgId)

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
            toastError(error)
          }
        }}
      />
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────

export default function OrganizationDetailPage() {
  const params = useParams<{ orgId: string }>()
  const orgId = params.orgId
  const router = useRouter()

  const org = useOrganization(orgId)
  const del = useDeleteOrganization()
  const [deleting, setDeleting] = useState(false)

  if (org.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <span className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (org.isError || !org.data) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <p className="text-muted-foreground">Organization not found or unavailable.</p>
        <Button variant="outline" onClick={() => router.push('/organizations')}>
          <IconArrowLeft className="size-4" /> Back to organizations
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="size-8" asChild>
            <Link href="/organizations">
              <IconArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{org.data.name}</h1>
            <p className="text-sm text-muted-foreground">@{org.data.slug}</p>
          </div>
        </div>
        <Button variant="destructive" size="sm" onClick={() => setDeleting(true)}>
          <IconTrash className="size-4" /> Delete
        </Button>
      </div>

      <SectionCard title={org.data.name} description={`@${org.data.slug}`}>
        <Tabs defaultValue="workspaces">
          <TabsList className="mb-4">
            <TabsTrigger value="workspaces">Workspaces</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="invitations">Invitations</TabsTrigger>
          </TabsList>
          <TabsContent value="workspaces">
            <WorkspacesTab orgId={orgId} />
          </TabsContent>
          <TabsContent value="members">
            <MembersTab orgId={orgId} />
          </TabsContent>
          <TabsContent value="invitations">
            <InvitationsTab orgId={orgId} />
          </TabsContent>
        </Tabs>
      </SectionCard>

      <SimpleAlertDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete organization"
        description={`Delete "${org.data.name}"? Its workspaces and storage accounts will be removed. This cannot be undone.`}
        confirmText="Delete"
        onConfirm={async () => {
          try {
            await del.mutateAsync(orgId)
            toast.success('Organization deleted')
            router.push('/organizations')
          } catch (error) {
            toastError(error)
          }
        }}
      />
    </div>
  )
}
