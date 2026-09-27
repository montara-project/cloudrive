'use client'

import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import slugify from 'slugify'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { useAppForm } from '@/hooks/form'
import { toastAxiosError } from '@/lib/api/axios-error'
import { OnboardingSurveySchema } from '@/lib/api/dtos/onboarding/schema'
import { CreateOrganizationSchema } from '@/lib/api/dtos/organization/schema'
import { queries } from '@/lib/api/queries'

type SurveyFormValues = {
  referral_source: string
  referral_source_detail: string
  use_cases: string[]
  use_case_detail: string
}

type OrgFormValues = {
  name: string
  slug: string
  logo: string
}

type StepOrganizationProps = {
  survey: SurveyFormValues
  defaultValues: OrgFormValues
  /** Receives the step's current values so going back never loses answers. */
  onBack: (values: OrgFormValues) => void
  /** Called with the created organization's id once this step succeeds. */
  onCreated: (organizationId: string) => void
}

// The create endpoint returns the bare organization JSON, while older client
// typings wrap it in { data } — accept both shapes when pulling the id out.
function extractOrganizationId(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const direct = body as { id?: unknown; data?: { id?: unknown } }
  if (typeof direct.id === 'string') return direct.id
  if (direct.data && typeof direct.data.id === 'string') return direct.data.id
  return null
}

export default function StepOrganization({
  survey,
  defaultValues,
  onBack,
  onCreated,
}: StepOrganizationProps) {
  const submitSurvey = useMutation(queries.onboarding.submitSurvey())
  const createOrganization = useMutation(queries.organizations.create())

  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: CreateOrganizationSchema,
      onChange: CreateOrganizationSchema,
    },
    onSubmit: async ({ value }) => {
      // The survey is required, so it must land before the organization is
      // created; the endpoint is an upsert, so retrying after a failed org
      // creation is safe. Answers were validated per step — re-parse as a
      // guard.
      const parsed = OnboardingSurveySchema.safeParse(survey)
      if (!parsed.success) {
        toast.error('Something is missing in your answers — please go back and check them.')
        return
      }

      try {
        await submitSurvey.mutateAsync(parsed.data)
        const created = await createOrganization.mutateAsync(value)
        const organizationId = extractOrganizationId(created)
        if (!organizationId) {
          toast.error('Organization created, but its id was missing from the response.')
          return
        }
        toast.success('Organization created')
        onCreated(organizationId)
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
            label="Organization name"
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

      <div className="flex items-center justify-between">
        <form.Subscribe selector={(state) => state.values}>
          {(values) => (
            <Button type="button" variant="ghost" onClick={() => onBack(values)}>
              <ArrowLeft aria-hidden />
              Back
            </Button>
          )}
        </form.Subscribe>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" />
              )}
              Create organization
              <ArrowRight aria-hidden />
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  )
}

export type { OrgFormValues }
