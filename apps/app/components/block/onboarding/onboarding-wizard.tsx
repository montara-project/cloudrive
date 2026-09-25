'use client'

import { useEffect, useRef, useState } from 'react'

import { Card } from '@/components/ui/card'

import { setWizardFinalStepActive } from './onboarding-phase'
import StepOrganization, { type OrgFormValues } from './step-organization'
import StepReferral, { type ReferralFormValues } from './step-referral'
import StepUseCases, { type UseCasesFormValues } from './step-use-cases'
import StepWorkspace from './step-workspace'
import Stepper from './stepper'

const STEPS = ['About you', 'Your use case', 'Organization', 'Workspace']

const HEADINGS = [
  'Welcome to Cloudrive',
  'How will you use it?',
  'Create your organization',
  'Create your workspace',
] as const

const SUBHEADINGS = [
  'Answer two quick questions so we can tailor your setup — then set up your organization.',
  'Pick everything that applies. You can always change this later.',
  'Organizations group your workspaces, members and storage. You can invite your team afterwards.',
  'Workspaces hold your storage accounts and S3 gateways. You can add more later.',
] as const

/**
 * The first-run wizard for users without any organization: two required
 * survey steps, then the organization that lifts the onboarding gate, then
 * its first workspace. Each step keeps its own form; submitted values live
 * here so going back never loses an answer. There is no Back from the final
 * step — the organization already exists by then.
 */
export default function OnboardingWizard() {
  const [step, setStep] = useState(0)
  const [referral, setReferral] = useState<ReferralFormValues>({
    referral_source: '',
    referral_source_detail: '',
  })
  const [useCases, setUseCases] = useState<UseCasesFormValues>({
    use_cases: [],
    use_case_detail: '',
  })
  const [organization, setOrganization] = useState<OrgFormValues>({
    name: '',
    slug: '',
    logo: '',
  })
  const [organizationId, setOrganizationId] = useState<string | null>(null)

  const headingRef = useRef<HTMLHeadingElement>(null)

  // Step changes swap the whole panel — move focus to the heading so screen
  // readers and keyboard users start from the top of the new step.
  useEffect(() => {
    headingRef.current?.focus()
  }, [step])

  // From the workspace step on, the gate would see the fresh organization and
  // bounce to the dashboard mid-wizard — tell it to hold off (set
  // synchronously in onCreated so it lands before the organizations refetch),
  // and release the flag when the wizard unmounts.
  useEffect(() => {
    return () => setWizardFinalStepActive(false)
  }, [])

  const survey = { ...referral, ...useCases }

  return (
    <div className="flex w-full max-w-xl flex-col gap-6">
      <Stepper steps={STEPS} current={step} />

      <Card className="gap-6 p-6 sm:p-8">
        {/* key={step} retriggers the enter animation on every step change */}
        <div
          key={step}
          className="animate-in fade-in-0 slide-in-from-bottom-1 motion-reduce:animate-none flex flex-col gap-6 duration-300"
        >
          <div className="flex flex-col gap-1.5">
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="text-2xl font-semibold tracking-tight focus:outline-none"
            >
              {HEADINGS[step]}
            </h1>
            <p className="text-muted-foreground">{SUBHEADINGS[step]}</p>
          </div>

          {step === 0 && (
            <StepReferral
              defaultValues={referral}
              onSubmit={(values) => {
                setReferral(values)
                setStep(1)
              }}
            />
          )}

          {step === 1 && (
            <StepUseCases
              defaultValues={useCases}
              onBack={(values) => {
                setUseCases(values)
                setStep(0)
              }}
              onSubmit={(values) => {
                setUseCases(values)
                setStep(2)
              }}
            />
          )}

          {step === 2 && (
            <StepOrganization
              survey={survey}
              defaultValues={organization}
              onBack={(values) => {
                setOrganization(values)
                setStep(1)
              }}
              onCreated={(id) => {
                setWizardFinalStepActive(true)
                setOrganizationId(id)
                setStep(3)
              }}
            />
          )}

          {step === 3 && organizationId && <StepWorkspace orgId={organizationId} />}
        </div>
      </Card>
    </div>
  )
}
