'use client'

import { IconHelp, IconSettings } from '@tabler/icons-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'

import ThemeToggle from '@/components/layout/theme-toggle'
import { Button } from '@/components/ui/button'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'

import AppSidebar from './app-sidebar'

interface SidebarLayoutProps {
  children: React.ReactNode
}

/**
 * The dashboard shell. The dashboard owns its full page header (welcome bar
 * with the utility cluster), so the shell renders it chrome-less; every other
 * page keeps the slim utility bar. Search lives in the sidebar, not the top
 * bar, matching the reference layout.
 */
export default function SidebarLayout({ children }: SidebarLayoutProps) {
  const pathname = usePathname()
  // /preview is the dev-only design-preview route rendering DashboardContent —
  // it gets the same chrome-less shell as the real dashboard.
  const isDashboard = pathname === '/dashboard' || pathname === '/preview'

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
        {isDashboard ? (
          <div className="flex flex-1 flex-col">{children}</div>
        ) : (
          <>
            <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur md:px-6">
              <SidebarTrigger className="-ml-1 lg:hidden" />
              <div className="ml-auto flex items-center gap-1">
                <ThemeToggle />
                <Button variant="ghost" size="icon" asChild>
                  <a
                    href="https://cloudrive.us.ci"
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Help"
                  >
                    <IconHelp className="size-4.5" />
                  </a>
                </Button>
                <Button variant="ghost" size="icon" asChild>
                  <Link href="/settings" aria-label="Settings">
                    <IconSettings className="size-4.5" />
                  </Link>
                </Button>
              </div>
            </header>
            <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">{children}</div>
          </>
        )}
      </SidebarInset>
    </SidebarProvider>
  )
}
