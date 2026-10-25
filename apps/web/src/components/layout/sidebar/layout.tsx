import { useRouterState } from '@tanstack/react-router'
import React from 'react'

import HeaderActions from '@/components/layout/header-actions'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'

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
 * The app shell: sidebar plus a sticky top bar (sidebar toggle, page name,
 * HeaderActions; h-16 to line up with the sidebar headers) over one content
 * container. Each page still renders PageHeader (title, page actions) inside it.
 */
export default function SidebarLayout({ children }: SidebarLayoutProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const segment = pathname.split('/')[1] ?? ''
  const title = segment.charAt(0).toUpperCase() + segment.slice(1)

  return (
    <SidebarProvider
      style={
        {
          // The org rail (icon width + 1px border) is carved out of the shell
          // width, so the main sidebar gets the full 18rem the design calls for.
          '--sidebar-width': 'calc(18rem + var(--sidebar-width-icon) + 1px)',
        } as React.CSSProperties
      }
    >
      <AppSidebar />
      {/* min-w-0: the inset is a flex item of the shell row — without it,
          wide fixed-width children (scrollable strips, data grids) block the
          shrink and push the whole row past the viewport. */}
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <span className="truncate text-sm font-medium">{title}</span>
          <HeaderActions />
        </header>
        <div className={CONTAINER}>{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
