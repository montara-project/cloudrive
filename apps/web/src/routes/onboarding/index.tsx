import { createFileRoute } from '@tanstack/react-router'

import OnboardingGate from '@/components/block/onboarding/onboarding-gate'

export const Route = createFileRoute('/onboarding/')({
  head: () => ({ meta: [{ title: 'Get started — Cloudrive' }] }),
  component: OnboardingGate,
})
