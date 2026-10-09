'use client'

import { useMutation } from '@tanstack/react-query'
import slugify from 'slugify'

import { useAppForm } from '@/hooks/form'
import { toastAxiosError } from '@/lib/api/axios-error'
import {
  CreateWorkspaceDto,
  CreateWorkspaceSchema,
  UpdateWorkspaceDto,
  UpdateWorkspaceSchema,
} from '@/lib/api/dtos/workspace/schema'
import { Models } from '@/lib/api/models'
import { queries } from '@/lib/api/queries'
import { BaseAbstractForm } from '@/types/form'

import SimpleAlertScrollableDialogForm from '../common/simple-alert-scrollable-dialog-form'

type TModel = CreateWorkspaceDto
type TMutation = CreateWorkspaceDto
type TDto = CreateWorkspaceDto | UpdateWorkspaceDto
type TResponse = Models.Workspace

type AbstractFormProps = Omit<BaseAbstractForm<TModel, TMutation, TDto, TResponse>, 'mutation'> & {
  mutation: {
    mutateAsync: (value: TMutation) => Promise<unknown>
    isPending: boolean
  }
  open: boolean
  onOpenChange: (open: boolean) => void
}

function AbstractForm({
  open,
  onOpenChange,
  defaultValues,
  schema,
  mutation,
  isEdit,
}: AbstractFormProps) {
  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: schema,
      onChange: schema,
    },
    onSubmit: async ({ value }) => {
      try {
        await mutation.mutateAsync(value)
      } catch (error) {
        toastAxiosError(error)
      } finally {
        form.reset()
        onOpenChange(false)
      }
    },
  })

  return (
    <SimpleAlertScrollableDialogForm
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
      open={open}
      onOpenChange={onOpenChange}
      title={`${isEdit ? 'Edit' : 'Create'} Workspace`}
      description="Workspaces hold storage accounts and S3 gateways."
      confirmText={isEdit ? 'Update' : 'Save'}
      loading={mutation.isPending}
      size="md"
    >
      <form.AppField
        name="name"
        children={(field) => (
          <field.TextField
            label="Name"
            placeholder="Production"
            asterisk
            onChange={(v) => {
              if (v) {
                const slug = slugify(v.toString(), {
                  lower: true,
                  strict: true,
                })
                form.setFieldValue('slug', slug)
              }
            }}
          />
        )}
      />

      <form.AppField
        name="slug"
        children={(field) => <field.TextField label="Slug" placeholder="production" asterisk />}
      />

      <form.AppField
        name="description"
        children={(field) => <field.TextareaField label="Description" placeholder="Optional" />}
      />
    </SimpleAlertScrollableDialogForm>
  )
}

type AddWorkspaceFormProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgId: string
  /** Called with the created workspace so callers can switch context to it. */
  onCreated?: (workspace: Models.Workspace) => void
}

export function AddWorkspaceForm({ open, onOpenChange, orgId, onCreated }: AddWorkspaceFormProps) {
  const mutation = useMutation(queries.workspaces.create(orgId))

  return (
    <AbstractForm
      open={open}
      onOpenChange={onOpenChange}
      defaultValues={{
        name: '',
        slug: '',
        description: '',
      }}
      schema={CreateWorkspaceSchema}
      mutation={{
        mutateAsync: async (value) => {
          const res = await mutation.mutateAsync(value)
          if (res.data) onCreated?.(res.data)
          return res
        },
        isPending: mutation.isPending,
      }}
    />
  )
}

type EditWorkspaceFormProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  record: Models.Workspace
}

export function EditWorkspaceForm({ open, onOpenChange, record }: EditWorkspaceFormProps) {
  const mutation = useMutation(queries.workspaces.update(record.id))

  return (
    <AbstractForm
      open={open}
      onOpenChange={onOpenChange}
      defaultValues={{
        ...record,
        description: record.description ?? '',
      }}
      schema={UpdateWorkspaceSchema}
      mutation={mutation}
      isEdit
    />
  )
}
