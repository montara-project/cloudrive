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
      router.replace('/login')
    }
  }, [isPending, session, router])

  // One layer covers both "still checking" and "checked, bouncing to /login" —
  // the dashboard never mounts without a session, so no chrome is ever shown
  // and then swapped out.
  if (isPending || !session) {
    return <SessionLoading />
  }

  return <SidebarLayout>{children}</SidebarLayout>
}
