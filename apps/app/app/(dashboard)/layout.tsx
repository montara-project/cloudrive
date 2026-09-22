'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import type { AuthSession } from '@/types/auth'

import GuardSkeleton from '@/components/block/dashboard/guard-skeleton'
import SidebarLayout from '@/components/layout/sidebar/layout'
import { getSession } from '@/lib/auth/handler'

export default function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [session, setSession] = useState<AuthSession | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    getSession().then((s) => {
      if (!s) {
        router.replace('/login')
        return
      }
      setSession(s)
      setChecked(true)
    })
  }, [router])

  if (!checked) {
    return <GuardSkeleton />
  }

  return <SidebarLayout auth={session}>{children}</SidebarLayout>
}
