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
import { UpdateStorageAccountSchema } from '@/lib/api/dtos/storage-account/schema'
import { queries } from '@/lib/api/queries'

interface EditAccountDialogProps {
  wsId: string
  account: Models.StorageAccount
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function EditAccountDialog({
  wsId,
  account,
  open,
  onOpenChange,
}: EditAccountDialogProps) {
  const update = useMutation(queries.storageAccounts.update(wsId))
  const [isLoading, setIsLoading] = useState(false)

  const form = useAppForm({
    defaultValues: {
      display_name: account.display_name,
      status: account.status as 'active' | 'pending_auth' | 'expired' | 'revoked' | 'error',
    },
    validators: {
      onSubmit: UpdateStorageAccountSchema,
    },
    onSubmit: async ({ value }) => {
      setIsLoading(true)
      try {
        await update.mutateAsync({
          accountId: account.id,
          display_name: value.display_name,
          status: value.status,
        })
        toast.success('Storage account updated')
        onOpenChange(false)
      } catch (error) {
        toastAxiosError(error)
      } finally {
        setIsLoading(false)
      }
    },
  })

  return (
    <SimpleDialog title="Edit storage account" open={open} onOpenChange={onOpenChange}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
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
        <Field className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isLoading}>
            {isLoading ? 'Saving…' : 'Save changes'}
          </Button>
        </Field>
      </form>
    </SimpleDialog>
  )
}
