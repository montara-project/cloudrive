'use client'

import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import SimpleDialog from '@/components/block/common/simple-dialog'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { useAppForm } from '@/hooks/form'
import { toastAxiosError } from '@/lib/api/axios-error'
import { CreateWorkspaceSchema, type CreateWorkspaceDto } from '@/lib/api/dtos/workspace/schema'
import { queries } from '@/lib/api/queries'

interface WorkspaceDialogProps {
  /** Organization to create the workspace in. Required when `workspace` is null. */
  orgId?: string
  /** When set, the dialog edits this workspace instead of creating one. */
  workspace?: Models.Workspace | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function WorkspaceDialog({
  orgId,
  workspace,
  open,
  onOpenChange,
}: WorkspaceDialogProps) {
  const create = useMutation(queries.workspaces.create(orgId ?? workspace?.organization_id ?? ''))
  const update = useMutation(queries.workspaces.update(workspace?.id ?? ''))
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
            description: value.description,
          })
          toast.success('Workspace updated')
        } else {
          await create.mutateAsync({
            name: value.name,
            slug: value.slug,
            description: value.description,
          })
          toast.success('Workspace created')
        }
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
