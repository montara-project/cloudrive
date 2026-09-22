'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { useAppForm } from '@/hooks/form'
import { throwAxiosError } from '@/lib/api/axios-error'
import { AddMemberSchema } from '@/lib/api/dtos/organization/schema'

import SimpleDialog from './simple-dialog'

interface MemberDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  roles: { value: string; label: string }[]
  onSubmit: (body: { user_id: string; role: string }) => Promise<unknown>
}

export default function MemberDialog({
  open,
  onOpenChange,
  title,
  roles,
  onSubmit,
}: MemberDialogProps) {
  const [isLoading, setIsLoading] = useState(false)

  const form = useAppForm({
    defaultValues: {
      user_id: '',
      role: roles[0]?.value ?? 'member',
    },
    validators: {
      onSubmit: AddMemberSchema,
    },
    onSubmit: async ({ value }) => {
      setIsLoading(true)
      try {
        await onSubmit(value)
        toast.success('Member added')
        onOpenChange(false)
        form.reset()
      } catch (error) {
        try {
          throwAxiosError(error as Error)
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'An error occurred')
        }
      } finally {
        setIsLoading(false)
      }
    },
  })

  return (
    <SimpleDialog title={title} open={open} onOpenChange={onOpenChange}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
      >
        <form.AppField
          name="user_id"
          children={(field) => (
            <field.TextField label="User ID" placeholder="UUID of the user" asterisk />
          )}
        />
        <form.AppField
          name="role"
          children={(field) => (
            <field.SelectField
              label="Role"
              options={roles.map((r) => ({ label: r.label, value: r.value }))}
              asterisk
            />
          )}
        />
        <Field className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isLoading}>
            {isLoading ? 'Adding…' : 'Add member'}
          </Button>
        </Field>
      </form>
    </SimpleDialog>
  )
}
