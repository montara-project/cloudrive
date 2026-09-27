'use client'

import { IconHelp, IconSettings } from '@tabler/icons-react'
import Link from 'next/link'
import React from 'react'

import GlobalSearch from '@/components/layout/global-search'
import ThemeToggle from '@/components/layout/theme-toggle'
import { Button } from '@/components/ui/button'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'

import AppSidebar from './app-sidebar'

interface SidebarLayoutProps {
  children: React.ReactNode
}

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
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur md:px-6">
          <SidebarTrigger className="-ml-1 lg:hidden" />

          <GlobalSearch />

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="icon" asChild>
              <a href="https://cloudrive.us.ci" target="_blank" rel="noreferrer" aria-label="Help">
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
      </SidebarInset>
    </SidebarProvider>
  )
}
