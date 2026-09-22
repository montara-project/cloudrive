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
import {
  CreateOrganizationSchema,
  type CreateOrganizationDto,
} from '@/lib/api/dtos/organization/schema'
import { queries } from '@/lib/api/queries'

interface OrganizationDialogProps {
  /** When set, the dialog edits this organization instead of creating one. */
  org?: Models.Organization | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function OrganizationDialog({ org, open, onOpenChange }: OrganizationDialogProps) {
  const create = useMutation(queries.organizations.create())
  const update = useMutation(queries.organizations.update(org?.id ?? ''))
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
            logo: value.logo,
          })
          toast.success('Organization updated')
        } else {
          await create.mutateAsync({
            name: value.name,
            slug: value.slug,
            logo: value.logo,
          })
          toast.success('Organization created')
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
