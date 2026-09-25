'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import SessionLoading from '@/components/block/auth/session-loading'
import SidebarLayout from '@/components/layout/sidebar/layout'
import { useHydrated } from '@/hooks/use-hydrated'
import { useSession } from '@/hooks/use-session'
import { queries } from '@/lib/api/queries'

export default function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const hydrated = useHydrated()
  const { data: session, isPending } = useSession()

  useEffect(() => {
    if (!isPending && !session) {
      router.replace('/')
    }
  }, [isPending, session, router])

  // First-run gate: a user without any organization is mid-onboarding — the
  // dashboard would scope every query to an empty id (`orgId ?? ''` in
  // use-workspace-context), so route them to the wizard instead. Shares the
  // query key with use-workspace-context, so the render below reuses this
  // fetch. Only a *successful* empty list triggers the redirect — a failed
  // request falls through to the dashboard's own empty states.
  const organizations = useQuery({
    ...queries.organizations.list({ limit: 100 }),
    enabled: !!session,
  })
  const hasNoOrganization =
    !!session && organizations.isSuccess && (organizations.data?.data?.length ?? 0) === 0

  useEffect(() => {
    if (hasNoOrganization) {
      router.replace('/onboarding')
    }
  }, [hasNoOrganization, router])

  // `!hydrated` keeps the hydration pass identical to the server render —
  // the optimistic session only exists client-side. After hydration the
  // snapshot is already in `data`, so the swap to the dashboard is instant;
  // the real probe still runs in the background and bounces to / if the
  // credential turns out to be dead.
  if (!hydrated || !session || organizations.isPending) {
    return <SessionLoading />
  }

  if (hasNoOrganization) {
    return <SessionLoading message="Preparing your onboarding…" />
  }

  return <SidebarLayout>{children}</SidebarLayout>
}
