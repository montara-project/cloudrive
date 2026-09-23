'use client'

import React from 'react'

import type { AuthSession } from '@/types/auth'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { getSidebarMenu } from '@/data/sidebar-menu'

import NavMain from './nav-main'
import NavUser from './nav-user'
import OrganizationSwitch from './organization-switch'

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
        <OrganizationSwitch />
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
