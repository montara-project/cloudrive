'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import SessionLoading from '@/components/block/auth/session-loading'
import SidebarLayout from '@/components/layout/sidebar/layout'
import { useHydrated } from '@/hooks/use-hydrated'
import { useSession } from '@/hooks/use-session'

export default function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const hydrated = useHydrated()
  const { data: session, isPending } = useSession()

  useEffect(() => {
    if (!isPending && !session) {
      router.replace('/')
    }
  }, [isPending, session, router])

  // `!hydrated` keeps the hydration pass identical to the server render —
  // the optimistic session only exists client-side. After hydration the
  // snapshot is already in `data`, so the swap to the dashboard is instant;
  // the real probe still runs in the background and bounces to / if the
  // credential turns out to be dead.
  if (!hydrated || !session) {
    return <SessionLoading />
  }

  return <SidebarLayout>{children}</SidebarLayout>
}
