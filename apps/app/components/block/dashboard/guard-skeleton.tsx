'use client'

import AppSidebarSkeleton from '@/components/layout/sidebar/app-sidebar-skeleton'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'

export default function GuardSkeleton() {
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
