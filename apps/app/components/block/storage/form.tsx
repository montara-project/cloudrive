'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import z from 'zod'

import { useAppForm } from '@/hooks/form'
import { toastAxiosError } from '@/lib/api/axios-error'
import {
  ConnectStorageAccountSchema,
  RotateStorageAccountCredentialsSchema,
  UpdateStorageAccountDto,
  UpdateStorageAccountSchema,
} from '@/lib/api/dtos/storage-account/schema'
import { Models } from '@/lib/api/models'
import { queries } from '@/lib/api/queries'

import SimpleAlertScrollableDialogForm from '../common/simple-alert-scrollable-dialog-form'

type ConnectFormValues = z.input<typeof ConnectStorageAccountSchema>

type ConnectStorageAccountFormProps = {
  wsId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ConnectStorageAccountForm({
  wsId,
  open,
  onOpenChange,
}: ConnectStorageAccountFormProps) {
  const providers = useQuery(queries.providers.list())
  const mutation = useMutation(queries.storageAccounts.connect())

  const providerOptions = (providers.data?.data ?? [])
    .filter((p) => p.is_active)
    .map((p) => ({ label: p.name, value: p.id }))

  const defaultValues: ConnectFormValues = {
    workspace_id: wsId,
    provider_id: '',
    display_name: '',
    account_email: '',
    external_account_id: '',
    credentials: '',
    settings: '',
  }

  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: ConnectStorageAccountSchema,
      onChange: ConnectStorageAccountSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        const dto = ConnectStorageAccountSchema.parse(value)
        await mutation.mutateAsync({
          workspace_id: dto.workspace_id,
          provider_id: dto.provider_id,
          display_name: dto.display_name,
          external_account_id: dto.external_account_id,
          credentials: dto.credentials,
          ...(dto.account_email ? { account_email: dto.account_email } : {}),
          ...(dto.settings ? { settings: dto.settings } : {}),
        })
      } catch (error) {
        toastAxiosError(error)
      } finally {
        form.reset()
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
      title="Connect storage account"
      description="Link a cloud storage provider account to this workspace."
      confirmText="Connect"
      loading={mutation.isPending}
      size="xl"
    >
      <form.AppField
        name="provider_id"
        children={(field) => (
          <field.SelectField
            label="Provider"
            placeholder="Select provider"
            options={providerOptions}
            loading={providers.isLoading}
            asterisk
          />
        )}
      />

      <form.AppField
        name="display_name"
        children={(field) => (
          <field.TextField label="Display name" placeholder="Production bucket" asterisk />
        )}
      />

      <form.AppField
        name="external_account_id"
        children={(field) => (
          <field.TextField
            label="External account ID"
            placeholder="Bucket name / account ID at the provider"
            asterisk
          />
        )}
      />

      <form.AppField
        name="account_email"
        children={(field) => <field.TextField label="Account email" placeholder="Optional" />}
      />

      <form.AppField
        name="credentials"
        children={(field) => (
          <field.TextareaField
            label="Credentials (JSON)"
            placeholder='{"access_key_id": "…", "secret_access_key": "…"}'
            note="Stored encrypted. Shape depends on the provider's auth type."
            rows={4}
            asterisk
          />
        )}
      />

      <form.AppField
        name="settings"
        children={(field) => (
          <field.TextareaField
            label="Settings (JSON, optional)"
            placeholder='{"region": "us-east-1"}'
            rows={3}
          />
        )}
      />
    </SimpleAlertScrollableDialogForm>
  )
}

type EditStorageAccountFormProps = {
  wsId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  record: Models.StorageAccount
}

export function EditStorageAccountForm({
  wsId,
  open,
  onOpenChange,
  record,
}: EditStorageAccountFormProps) {
  const update = useMutation(queries.storageAccounts.update(wsId))
  const mutation = {
    mutateAsync: (value: UpdateStorageAccountDto) =>
      update.mutateAsync({ accountId: record.id, ...value }),
    isPending: update.isPending,
  }

  const form = useAppForm({
    defaultValues: {
      display_name: record.display_name,
      status: record.status as UpdateStorageAccountDto['status'],
    },
    validators: {
      onSubmit: UpdateStorageAccountSchema,
      onChange: UpdateStorageAccountSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        await mutation.mutateAsync(value)
      } catch (error) {
        toastAxiosError(error)
      } finally {
        form.reset()
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
      title="Edit storage account"
      confirmText="Update"
      loading={mutation.isPending}
      size="xl"
    >
      <form.AppField
        name="display_name"
        children={(field) => <field.TextField label="Display name" asterisk />}
      />

      <form.AppField
        name="status"
        children={(field) => (
          <field.SelectField
            label="Status"
            options={[
              { label: 'Active', value: 'active' },
              { label: 'Pending auth', value: 'pending_auth' },
              { label: 'Expired', value: 'expired' },
              { label: 'Revoked', value: 'revoked' },
              { label: 'Error', value: 'error' },
            ]}
          />
        )}
      />
    </SimpleAlertScrollableDialogForm>
  )
}

type RotateCredentialsFormProps = {
  wsId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  record: Models.StorageAccount
}

export function RotateCredentialsForm({
  wsId,
  open,
  onOpenChange,
  record,
}: RotateCredentialsFormProps) {
  const rotate = useMutation(queries.storageAccounts.rotate(wsId))
  const mutation = {
    mutateAsync: (value: z.input<typeof RotateStorageAccountCredentialsSchema>) =>
      rotate.mutateAsync({
        accountId: record.id,
        credentials: RotateStorageAccountCredentialsSchema.parse(value).credentials,
      }),
    isPending: rotate.isPending,
  }

  const defaultValues: z.input<typeof RotateStorageAccountCredentialsSchema> = {
    credentials: '',
  }

  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: RotateStorageAccountCredentialsSchema,
      onChange: RotateStorageAccountCredentialsSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        await mutation.mutateAsync(value)
      } catch (error) {
        toastAxiosError(error)
      } finally {
        form.reset()
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
      title="Rotate credentials"
      description={`Replace the stored credentials for "${record.display_name}".`}
      confirmText="Rotate"
      loading={mutation.isPending}
      size="xl"
    >
      <form.AppField
        name="credentials"
        children={(field) => (
          <field.TextareaField
            label="New credentials (JSON)"
            placeholder='{"access_key_id": "…", "secret_access_key": "…"}'
            rows={4}
            asterisk
          />
        )}
      />
    </SimpleAlertScrollableDialogForm>
  )
}
