'use client'

import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import slugify from 'slugify'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { useAppForm } from '@/hooks/form'
import { toastAxiosError } from '@/lib/api/axios-error'
import { CreateWorkspaceSchema } from '@/lib/api/dtos/workspace/schema'
import { queries } from '@/lib/api/queries'

type WorkspaceFormValues = {
  name: string
  slug: string
  description: string
}

type StepWorkspaceProps = {
  /** The organization created in the previous step. */
  orgId: string
}

/**
 * Final wizard step: the first workspace inside the freshly created
 * organization. There is no Back here on purpose — the organization already
 * exists, so going back would only offer to re-create it.
 */
export default function StepWorkspace({ orgId }: StepWorkspaceProps) {
  const router = useRouter()
  const createWorkspace = useMutation(queries.workspaces.create(orgId))

  const form = useAppForm({
    defaultValues: {
      name: '',
      slug: '',
      description: '',
    } satisfies WorkspaceFormValues,
    validators: {
      onSubmit: CreateWorkspaceSchema,
      onChange: CreateWorkspaceSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        await createWorkspace.mutateAsync(value)
        toast.success('Your workspace is ready — welcome to Cloudrive!')
        // The workspace query for this org is invalidated by the mutation,
        // and the dashboard context picks the first org + workspace.
        router.replace('/dashboard')
      } catch (error) {
        toastAxiosError(error)
      }
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
      className="flex flex-col gap-6"
    >
      <form.AppField
        name="name"
        children={(field) => (
          <field.TextField
            label="Workspace name"
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
        children={(field) => (
          <field.TextField label="Slug" placeholder="production" asterisk disabled />
        )}
      />

      <form.AppField
        name="description"
        children={(field) => <field.TextareaField label="Description" placeholder="Optional" />}
      />

      <div className="flex items-center justify-end">
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" />
              )}
              Create workspace
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  )
}
