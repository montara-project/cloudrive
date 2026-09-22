'use client'

import Link from 'next/link'
import React from 'react'

import type { AuthSession } from '@/types/auth'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { getSidebarMenu } from '@/data/sidebar-menu'

import NavMain from './nav-main'
import NavUser from './nav-user'

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  auth?: AuthSession | null
}

export default function AppSidebar({ auth, ...props }: AppSidebarProps) {
  const menu = getSidebarMenu()

  const user = auth
    ? {
        name: [auth.user.first_name, auth.user.last_name].filter(Boolean).join(' ') || 'User',
        email: auth.user.email,
        avatar: auth.user.image ?? '',
      }
    : { ...menu.user }

  return (
    <Sidebar collapsible="icon" variant="floating" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <svg viewBox="0 0 32 32" className="size-5" aria-hidden>
                    <path
                      d="M10.5 22.5a4.6 4.6 0 0 1-.5-9.17A6.3 6.3 0 0 1 22.4 14.4a4.1 4.1 0 0 1-.9 8.1z"
                      fill="currentColor"
                    />
                    <circle cx="16" cy="18.4" r="2.1" fill="#D97706" />
                  </svg>
                </div>
                <div className="flex flex-col gap-1 leading-none">
                  <span className="font-medium">Cloudrive</span>
                  <span className="text-muted-foreground">Cloud Storage</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain title="Overview" items={menu.navMenu.overview} />
        <NavMain title="Manage" items={menu.navMenu.manage} />
        <NavMain title="Storage" items={menu.navMenu.storage} />
        {menu.navSetting.length > 0 && <NavMain title="Settings" items={menu.navSetting} />}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
