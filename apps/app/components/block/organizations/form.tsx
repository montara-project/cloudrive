'use client'

import { useMutation } from '@tanstack/react-query'
import slugify from 'slugify'

import { useAppForm } from '@/hooks/form'
import { toastAxiosError } from '@/lib/api/axios-error'
import {
  CreateOrganizationDto,
  CreateOrganizationSchema,
  UpdateOrganizationDto,
  UpdateOrganizationSchema,
} from '@/lib/api/dtos/organization/schema'
import { Models } from '@/lib/api/models'
import { queries } from '@/lib/api/queries'
import { BaseAbstractForm } from '@/types/form'

import SimpleAlertScrollableDialogForm from '../common/simple-alert-scrollable-dialog-form'

type TModel = CreateOrganizationDto
type TMutation = CreateOrganizationDto
type TDto = CreateOrganizationDto | UpdateOrganizationDto
type TResponse = Models.Organization

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
      title={`${isEdit ? 'Edit' : 'Create'} Organization`}
      description="Organizations group workspaces, members and storage."
      confirmText={isEdit ? 'Update' : 'Save'}
      loading={mutation.isPending}
      size="md"
    >
      <form.AppField
        name="name"
        children={(field) => (
          <field.TextField
            label="Name"
            placeholder="Acme Inc."
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
        children={(field) => <field.TextField label="Slug" placeholder="acme" asterisk disabled />}
      />

      <form.AppField
        name="logo"
        children={(field) => <field.TextField label="Logo URL" placeholder="https://…" />}
      />
    </SimpleAlertScrollableDialogForm>
  )
}

type AddOrganizationFormProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddOrganizationForm({ open, onOpenChange }: AddOrganizationFormProps) {
  const mutation = useMutation(queries.organizations.create())

  return (
    <AbstractForm
      open={open}
      onOpenChange={onOpenChange}
      defaultValues={{
        name: '',
        slug: '',
        logo: '',
      }}
      schema={CreateOrganizationSchema}
      mutation={mutation}
    />
  )
}

type EditOrganizationFormProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  record: Models.Organization
}

export function EditOrganizationForm({ open, onOpenChange, record }: EditOrganizationFormProps) {
  const mutation = useMutation(queries.organizations.update(record.id))

  return (
    <AbstractForm
      open={open}
      onOpenChange={onOpenChange}
      defaultValues={{
        ...record,
        logo: record.logo ?? '',
      }}
      schema={UpdateOrganizationSchema}
      mutation={mutation}
      isEdit
    />
  )
}
