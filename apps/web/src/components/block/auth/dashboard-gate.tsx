import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

import SessionLoading from '@/components/block/auth/session-loading'
import SidebarLayout from '@/components/layout/sidebar/layout'
import { useSession } from '@/hooks/use-session'
import { queries } from '@/lib/api/queries'

/**
 * Guard for every (dashboard) route: needs a session, and at least one
 * organization.
 */
export default function DashboardGate({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const { data: session, isPending } = useSession()

  useEffect(() => {
    if (!isPending && !session) {
      void navigate({ to: '/sign-in', replace: true })
    }
  }, [isPending, session, navigate])

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
      void navigate({ to: '/onboarding', replace: true })
    }
  }, [hasNoOrganization, navigate])

  // The optimistic session (placeholderData) paints the dashboard at once; the
  // real probe still runs in the background and bounces to /sign-in if the
  // credential turns out to be dead.
  if (!session || organizations.isPending) {
    return <SessionLoading />
  }

  if (hasNoOrganization) {
    return <SessionLoading message="Preparing your onboarding…" />
  }

  return <SidebarLayout>{children}</SidebarLayout>
}
