'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import SimpleDialog from '@/components/block/common/simple-dialog'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { useAppForm } from '@/hooks/form'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

interface ConnectAccountDialogProps {
  wsId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function ConnectAccountDialog({
  wsId,
  open,
  onOpenChange,
}: ConnectAccountDialogProps) {
  const providers = useQuery(queries.providers.list())
  const connect = useMutation(queries.storageAccounts.connect())
  const [isLoading, setIsLoading] = useState(false)

  const providerOptions = (providers.data?.data ?? [])
    .filter((p) => p.is_active)
    .map((p) => ({ label: p.name, value: p.id }))

  const form = useAppForm({
    defaultValues: {
      provider_id: '',
      display_name: '',
      account_email: '',
      external_account_id: '',
      credentials: '',
      settings: '',
    },
    onSubmit: async ({ value }) => {
      setIsLoading(true)
      try {
        let credentials: Record<string, unknown>
        try {
          credentials = JSON.parse(value.credentials)
        } catch {
          toast.error('Credentials must be a valid JSON object')
          setIsLoading(false)
          return
        }
        let settings: Record<string, unknown> | undefined
        if (value.settings?.trim()) {
          try {
            settings = JSON.parse(value.settings)
          } catch {
            toast.error('Settings must be a valid JSON object')
            setIsLoading(false)
            return
          }
        }
        await connect.mutateAsync({
          workspace_id: wsId,
          provider_id: value.provider_id,
          display_name: value.display_name,
          external_account_id: value.external_account_id,
          credentials,
          ...(value.account_email ? { account_email: value.account_email } : {}),
          ...(settings ? { settings } : {}),
        })
        toast.success('Storage account connected')
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
      title="Connect storage account"
      description="Link a cloud storage provider account to this workspace."
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
        <Field className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isLoading}>
            {isLoading ? 'Connecting…' : 'Connect'}
          </Button>
        </Field>
      </form>
    </SimpleDialog>
  )
}
