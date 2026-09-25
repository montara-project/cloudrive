'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import SessionLoading from '@/components/block/auth/session-loading'
import SidebarLayout from '@/components/layout/sidebar/layout'
import { useSession } from '@/hooks/use-session'

export default function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { data: session, isPending } = useSession()

  useEffect(() => {
    if (!isPending && !session) {
      router.replace('/')
    }
  }, [isPending, session, router])

  // Mount as soon as any session exists — including the optimistic snapshot —
  // so returning users skip the loading screen entirely. A real probe still
  // runs in the background; if the credential is dead the query resolves null
  // and the effect above bounces to /.
  if (!session) {
    return <SessionLoading />
  }

  return <SidebarLayout>{children}</SidebarLayout>
}
