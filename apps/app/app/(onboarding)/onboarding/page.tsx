import type { Metadata } from 'next'

import OnboardingGate from '@/components/block/onboarding/onboarding-gate'

export const metadata: Metadata = {
  title: 'Get started — Cloudrive',
}

export default function OnboardingPage() {
  return <OnboardingGate />
}
