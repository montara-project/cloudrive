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
import { queries } from '@/lib/api/queries'

interface RotateCredentialsDialogProps {
  wsId: string
  account: Models.StorageAccount
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function RotateCredentialsDialog({
  wsId,
  account,
  open,
  onOpenChange,
}: RotateCredentialsDialogProps) {
  const rotate = useMutation(queries.storageAccounts.rotate(wsId))
  const [isLoading, setIsLoading] = useState(false)

  const form = useAppForm({
    defaultValues: { credentials: '' },
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
        await rotate.mutateAsync({ accountId: account.id, credentials })
        toast.success('Credentials rotated')
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
      title="Rotate credentials"
      description={`Replace the stored credentials for "${account.display_name}".`}
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
        <Field className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isLoading}>
            {isLoading ? 'Rotating…' : 'Rotate'}
          </Button>
        </Field>
      </form>
    </SimpleDialog>
  )
}
