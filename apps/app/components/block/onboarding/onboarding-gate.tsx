'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import SessionLoading from '@/components/block/auth/session-loading'
import { useHydrated } from '@/hooks/use-hydrated'
import { useSession } from '@/hooks/use-session'
import { queries } from '@/lib/api/queries'

import { isWizardFinalStepActive } from './onboarding-phase'
import OnboardingWizard from './onboarding-wizard'

/**
 * Entry gate for the first-run wizard.
 *
 * Reachable only by an authenticated user with no organization: visitors
 * without a session bounce to sign-in, and anyone who already has an
 * organization goes straight to the dashboard — the wizard's job is done at
 * that point. The one exception is the wizard's own final step: the
 * organization was just created there and the workspace step still needs the
 * live wizard, so the gate holds off while that step is active
 * (`isWizardFinalStepActive`).
 */
export default function OnboardingGate() {
  const router = useRouter()
  const hydrated = useHydrated()
  const { data: session, isPending } = useSession()

  useEffect(() => {
    if (!isPending && !session) {
      router.replace('/')
    }
  }, [isPending, session, router])

  // Shares the query key with the dashboard's gate and the workspace
  // context, so the dashboard render after onboarding reuses this fetch.
  const organizations = useQuery({
    ...queries.organizations.list({ limit: 100 }),
    enabled: !!session,
  })

  const hasOrganization =
    !!session && organizations.isSuccess && (organizations.data?.data?.length ?? 0) > 0
  // The signal is read at render time on purpose: it is always set
  // synchronously before the organizations refetch (triggered by the org
  // create mutation) can land and re-render this gate.
  const wizardFinalStepActive = hasOrganization && isWizardFinalStepActive()

  useEffect(() => {
    if (hasOrganization && !wizardFinalStepActive) {
      router.replace('/dashboard')
    }
  }, [hasOrganization, wizardFinalStepActive, router])

  if (!hydrated || isPending || !session || organizations.isPending) {
    return <SessionLoading />
  }

  if (hasOrganization && !wizardFinalStepActive) {
    return (
      <SessionLoading message={hydrated && session ? 'Taking you to your drive…' : undefined} />
    )
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="animate-in fade-in-0 slide-in-from-bottom-1 motion-reduce:animate-none flex w-full justify-center duration-300">
        <OnboardingWizard />
      </div>
    </main>
  )
}
