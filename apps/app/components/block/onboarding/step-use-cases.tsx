'use client'

import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Braces,
  CloudUpload,
  MoreHorizontal,
  Terminal,
  Users,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAppForm } from '@/hooks/form'
import { UseCasesStepSchema } from '@/lib/api/dtos/onboarding/schema'

import type { CheckboxOption } from '../form/checkbox-group-field'

const USE_CASE_OPTIONS: CheckboxOption[] = [
  {
    value: 'personal_backup',
    label: 'Personal backup',
    description: 'Keep my files safe in the cloud',
    icon: CloudUpload,
  },
  {
    value: 'team_collaboration',
    label: 'Team collaboration',
    description: 'Share and work on files together',
    icon: Users,
  },
  {
    value: 's3_api_integration',
    label: 'S3-compatible integration',
    description: 'Connect apps via the S3 API',
    icon: Braces,
  },
  {
    value: 'media_archive',
    label: 'Media & archive',
    description: 'Photos, videos and long-term storage',
    icon: Archive,
  },
  {
    value: 'development',
    label: 'Development & testing',
    description: 'Spin up storage for my projects',
    icon: Terminal,
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Something else',
    icon: MoreHorizontal,
  },
]

type UseCasesFormValues = {
  use_cases: string[]
  use_case_detail: string
}

type StepUseCasesProps = {
  defaultValues: UseCasesFormValues
  /** Receives the step's current values so going back never loses answers. */
  onBack: (values: UseCasesFormValues) => void
  onSubmit: (values: UseCasesFormValues) => void
}

export default function StepUseCases({ defaultValues, onBack, onSubmit }: StepUseCasesProps) {
  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: UseCasesStepSchema,
      onChange: UseCasesStepSchema,
    },
    onSubmit: async ({ value }) => {
      onSubmit(value)
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
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium">What will you use Cloudrive for?</p>
        <form.AppField
          name="use_cases"
          children={(field) => <field.CheckboxGroupField options={USE_CASE_OPTIONS} />}
        />
      </div>

      <form.Subscribe selector={(state) => state.values.use_cases}>
        {(useCases) =>
          useCases.includes('other') ? (
            <form.AppField
              name="use_case_detail"
              children={(field) => (
                <field.TextField
                  label="Tell us more"
                  placeholder="What are you planning to store?"
                />
              )}
            />
          ) : null
        }
      </form.Subscribe>

      <div className="flex items-center justify-between">
        <form.Subscribe selector={(state) => state.values}>
          {(values) => (
            <Button type="button" variant="ghost" onClick={() => onBack(values)}>
              <ArrowLeft aria-hidden />
              Back
            </Button>
          )}
        </form.Subscribe>
        <Button type="submit" variant="primary">
          Continue
          <ArrowRight aria-hidden />
        </Button>
      </div>
    </form>
  )
}

export type { UseCasesFormValues }
