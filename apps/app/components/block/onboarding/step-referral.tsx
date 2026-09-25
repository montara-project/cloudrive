'use client'

import {
  GitBranch,
  MessageSquare,
  MoreHorizontal,
  Search,
  Share2,
  UserRound,
  ArrowRight,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAppForm } from '@/hooks/form'
import { ReferralStepSchema } from '@/lib/api/dtos/onboarding/schema'

import type { RadioOption } from '../form/radio-group-field'

const REFERRAL_OPTIONS: RadioOption[] = [
  {
    value: 'search_engine',
    label: 'Search engine',
    description: 'Google, Bing, DuckDuckGo…',
    icon: Search,
  },
  {
    value: 'social_media',
    label: 'Social media',
    description: 'X, LinkedIn, Instagram…',
    icon: Share2,
  },
  {
    value: 'recommendation',
    label: 'Friend or colleague',
    description: 'Someone recommended it to me',
    icon: UserRound,
  },
  {
    value: 'community',
    label: 'Online community',
    description: 'Reddit, Discord, forums…',
    icon: MessageSquare,
  },
  {
    value: 'github',
    label: 'GitHub',
    description: 'Found the project or its docs',
    icon: GitBranch,
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Somewhere else',
    icon: MoreHorizontal,
  },
]

type ReferralFormValues = {
  referral_source: string
  referral_source_detail: string
}

type StepReferralProps = {
  defaultValues: ReferralFormValues
  onSubmit: (values: ReferralFormValues) => void
}

export default function StepReferral({ defaultValues, onSubmit }: StepReferralProps) {
  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: ReferralStepSchema,
      onChange: ReferralStepSchema,
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
        <p className="text-sm font-medium">Where did you hear about Cloudrive?</p>
        <form.AppField
          name="referral_source"
          children={(field) => <field.RadioGroupField options={REFERRAL_OPTIONS} />}
        />
      </div>

      <form.Subscribe selector={(state) => state.values.referral_source}>
        {(referralSource) =>
          referralSource === 'other' ? (
            <form.AppField
              name="referral_source_detail"
              children={(field) => (
                <field.TextField
                  label="Tell us more"
                  placeholder="e.g. A blog post, a newsletter…"
                />
              )}
            />
          ) : null
        }
      </form.Subscribe>

      <div className="flex items-center justify-end">
        <Button type="submit" variant="primary">
          Continue
          <ArrowRight aria-hidden />
        </Button>
      </div>
    </form>
  )
}

export type { ReferralFormValues }
