'use client'

import React from 'react'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { SIDEBAR_MENU } from '@/data/sidebar-menu'
import { useSession } from '@/hooks/use-session'

import NavMain from './nav-main'
import NavUser from './nav-user'
import OrganizationSwitch from './organization-switch'
import WorkspaceSwitch from './workspace-switch'

type AppSidebarProps = React.ComponentProps<typeof Sidebar>

export default function AppSidebar(props: AppSidebarProps) {
  const menu = SIDEBAR_MENU
  const { data: session } = useSession()

  const user = session
    ? {
        name: [session.user.first_name, session.user.last_name].filter(Boolean).join(' ') || 'User',
        email: session.user.email,
        avatar: session.user.image ?? '',
      }
    : { ...menu.user }

  return (
    <Sidebar collapsible="icon" variant="floating" {...props}>
      {/* Account scope first: the organization, then the workspace everything
          storage-related is read and written against. */}
      <SidebarHeader className="gap-1">
        <OrganizationSwitch />
        <WorkspaceSwitch />
      </SidebarHeader>
      <SidebarSeparator />
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
