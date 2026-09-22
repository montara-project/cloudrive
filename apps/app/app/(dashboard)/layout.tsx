'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import type { AuthSession } from '@/types/auth'

import AppSidebarSkeleton from '@/components/layout/sidebar/app-sidebar-skeleton'
import SidebarLayout from '@/components/layout/sidebar/layout'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { getSession } from '@/lib/auth/handler'

function GuardSkeleton() {
  return (
    <SidebarProvider>
      <AppSidebarSkeleton />
      <SidebarInset>
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

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
