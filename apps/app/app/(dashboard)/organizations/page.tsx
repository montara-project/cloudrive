'use client'

import { IconDotsVertical, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { useQueryState } from 'nuqs'
import { useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import DataTable, { type DataTableColumn } from '@/components/block/common/data-table'
import Pagination from '@/components/block/common/pagination'
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
import { useAppForm } from '@/hooks/form'
import { throwAxiosError } from '@/lib/api/axios-error'
import {
  CreateOrganizationSchema,
  type CreateOrganizationDto,
} from '@/lib/api/dtos/organization/schema'
import {
  useCreateOrganization,
  useDeleteOrganization,
  useOrganizations,
  useUpdateOrganization,
} from '@/lib/api/queries'

type Organization = Models.Organization

function toastError(error: unknown) {
  try {
    throwAxiosError(error as Error)
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'An error occurred')
  }
}

function OrgDialog({
  open,
  onOpenChange,
  org,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  org: Organization | null
}) {
  const create = useCreateOrganization()
  const update = useUpdateOrganization(org?.id ?? '')
  const [isLoading, setIsLoading] = useState(false)

  const form = useAppForm({
    defaultValues: {
      name: org?.name ?? '',
      slug: org?.slug ?? '',
      logo: org?.logo ?? '',
    } satisfies CreateOrganizationDto,
    validators: {
      onSubmit: CreateOrganizationSchema,
    },
    onSubmit: async ({ value }) => {
      setIsLoading(true)
      try {
        if (org) {
          await update.mutateAsync({
            name: value.name,
            ...(value.logo ? { logo: value.logo } : {}),
          })
          toast.success('Organization updated')
        } else {
          await create.mutateAsync({
            name: value.name,
            slug: value.slug,
            ...(value.logo ? { logo: value.logo } : {}),
          })
          toast.success('Organization created')
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
      title={org ? 'Edit organization' : 'Create organization'}
      description={org ? undefined : 'Organizations group workspaces, members and storage.'}
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
          children={(field) => <field.TextField label="Name" placeholder="Acme Inc." asterisk />}
        />
        <form.AppField
          name="slug"
          children={(field) => (
            <field.TextField label="Slug" placeholder="acme" asterisk disabled={!!org} />
          )}
        />
        <form.AppField
          name="logo"
          children={(field) => <field.TextField label="Logo URL" placeholder="https://…" />}
        />
        <Field className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isLoading}>
            {isLoading ? 'Saving…' : org ? 'Save changes' : 'Create'}
          </Button>
        </Field>
      </form>
    </SimpleDialog>
  )
}

export default function OrganizationsPage() {
  const router = useRouter()
  const [pageParam] = useQueryState('page')
  const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1)
  const limit = 10

  const orgs = useOrganizations({
    page,
    limit,
    order_by: 'created_at',
    order: 'desc',
  })

  const [dialog, setDialog] = useState<{ open: boolean; org: Organization | null }>({
    open: false,
    org: null,
  })
  const [deleting, setDeleting] = useState<Organization | null>(null)
  const del = useDeleteOrganization()

  const columns: DataTableColumn<Organization>[] = [
    {
      header: 'Name',
      cell: (o) => <span className="font-medium">{o.name}</span>,
    },
    {
      header: 'Slug',
      cell: (o) => <span className="text-muted-foreground">@{o.slug}</span>,
    },
    {
      header: 'Created',
      cell: (o) => (
        <span className="text-muted-foreground">
          {o.created_at ? new Date(o.created_at).toLocaleDateString() : '—'}
        </span>
      ),
    },
    {
      header: '',
      className: 'w-12 text-right',
      cell: (o) => (
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
                setDialog({ open: true, org: o })
              }}
            >
              <IconPencil className="size-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={(e) => {
                e.stopPropagation()
                setDeleting(o)
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
        title="Organizations"
        description="Your organizations and teams."
        toolbar={
          <Button variant="primary" size="sm" onClick={() => setDialog({ open: true, org: null })}>
            <IconPlus className="size-4" /> New organization
          </Button>
        }
      >
        <DataTable
          columns={columns}
          rows={orgs.data?.data ?? []}
          loading={orgs.isLoading}
          empty="No organizations yet. Create one to get started."
          onRowClick={(o) => router.push(`/organizations/${o.id}`)}
        />
        <Pagination total={orgs.data?.metadata?.total} limit={limit} />
      </SectionCard>

      <OrgDialog
        key={dialog.org?.id ?? 'new'}
        open={dialog.open}
        onOpenChange={(open) => setDialog({ open, org: open ? dialog.org : null })}
        org={dialog.org}
      />

      <SimpleAlertDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete organization"
        description={`Delete "${deleting?.name}"? Its workspaces and storage accounts will be removed. This cannot be undone.`}
        confirmText="Delete"
        onConfirm={async () => {
          if (!deleting) return
          try {
            await del.mutateAsync(deleting.id)
            toast.success('Organization deleted')
            setDeleting(null)
          } catch (error) {
            toastError(error)
          }
        }}
      />
    </>
  )
}
