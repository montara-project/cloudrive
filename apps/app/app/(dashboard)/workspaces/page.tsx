'use client'

import { IconDotsVertical, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { useQueryState } from 'nuqs'
import { useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import DataTable, { type DataTableColumn } from '@/components/block/common/data-table'
import SectionCard from '@/components/block/common/section-card'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import SimpleDialog from '@/components/block/common/simple-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Field } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAppForm } from '@/hooks/form'
import { throwAxiosError } from '@/lib/api/axios-error'
import { CreateWorkspaceSchema, type CreateWorkspaceDto } from '@/lib/api/dtos/workspace/schema'
import {
  useCreateWorkspace,
  useDeleteWorkspace,
  useOrganizations,
  useUpdateWorkspace,
  useWorkspaces,
} from '@/lib/api/queries'

type Workspace = Models.Workspace

function toastError(error: unknown) {
  try {
    throwAxiosError(error as Error)
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'An error occurred')
  }
}

function WorkspaceDialog({
  orgId,
  workspace,
  open,
  onOpenChange,
}: {
  orgId: string
  workspace: Workspace | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const create = useCreateWorkspace(orgId)
  const update = useUpdateWorkspace(workspace?.id ?? '')
  const [isLoading, setIsLoading] = useState(false)

  const form = useAppForm({
    defaultValues: {
      name: workspace?.name ?? '',
      slug: workspace?.slug ?? '',
      description: workspace?.description ?? '',
    } satisfies CreateWorkspaceDto,
    validators: {
      onSubmit: CreateWorkspaceSchema,
    },
    onSubmit: async ({ value }) => {
      setIsLoading(true)
      try {
        if (workspace) {
          await update.mutateAsync({
            name: value.name,
            ...(value.description ? { description: value.description } : {}),
          })
          toast.success('Workspace updated')
        } else {
          await create.mutateAsync({
            name: value.name,
            slug: value.slug,
            ...(value.description ? { description: value.description } : {}),
          })
          toast.success('Workspace created')
        }
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
      title={workspace ? 'Edit workspace' : 'Create workspace'}
      description={workspace ? undefined : 'Workspaces hold storage accounts and S3 gateways.'}
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
          children={(field) => (
            <field.TextField
              label="Slug"
              placeholder="production"
              asterisk={!workspace}
              disabled={!!workspace}
            />
          )}
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
            {isLoading ? 'Saving…' : workspace ? 'Save changes' : 'Create'}
          </Button>
        </Field>
      </form>
    </SimpleDialog>
  )
}

export default function WorkspacesPage() {
  const router = useRouter()
  const [orgId, setOrgId] = useQueryState('org')

  const orgs = useOrganizations({ limit: 100 })
  const workspaces = useWorkspaces(orgId ?? undefined, {
    limit: 100,
    order_by: 'created_at',
    order: 'desc',
  })

  const [dialog, setDialog] = useState<{ open: boolean; ws: Workspace | null }>({
    open: false,
    ws: null,
  })
  const [deleting, setDeleting] = useState<Workspace | null>(null)
  const del = useDeleteWorkspace()

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

      {orgId && (
        <WorkspaceDialog
          key={dialog.ws?.id ?? 'new'}
          orgId={orgId}
          workspace={dialog.ws}
          open={dialog.open}
          onOpenChange={(open) => setDialog({ open, ws: open ? dialog.ws : null })}
        />
      )}

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
    </>
  )
}
