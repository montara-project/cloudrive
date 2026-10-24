import React from 'react'

import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'

import AppSidebar from './app-sidebar'

interface SidebarLayoutProps {
  children: React.ReactNode
}

/**
 * One content container for every page, sized like the dashboard: centred,
 * capped at max-w-360, with the same padding and section gap.
 */
const CONTAINER = 'mx-auto flex w-full min-w-0 max-w-360 flex-1 flex-col gap-5 p-4 md:gap-6 md:p-6'

/**
 * The app shell: sidebar plus one content container. There is no top bar —
 * each page renders PageHeader (title, actions, utility cluster), the way the
 * dashboard always did. Search lives in the sidebar.
 */
export default function SidebarLayout({ children }: SidebarLayoutProps) {
  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': '19rem',
        } as React.CSSProperties
      }
    >
      <AppSidebar />
      {/* min-w-0: the inset is a flex item of the shell row — without it,
          wide fixed-width children (scrollable strips, data grids) block the
          shrink and push the whole row past the viewport. */}
      <SidebarInset className="min-w-0">
        <div className={CONTAINER}>{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
