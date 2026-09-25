'use client'

import Image from 'next/image'
import Link from 'next/link'
import React from 'react'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { SIDEBAR_MENU } from '@/data/sidebar-menu'
import { useSession } from '@/hooks/use-session'

import NavMain from './nav-main'
import NavUser from './nav-user'
import OrganizationRail from './organization-rail'
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
    <Sidebar
      collapsible="icon"
      className="overflow-hidden *:data-[sidebar=sidebar]:flex-row"
      {...props}
    >
      {/* This is the first sidebar */}
      {/* We disable collapsible and adjust width to icon. */}
      {/* This will make the sidebar appear as icons. */}
      <Sidebar collapsible="none" className="w-[calc(var(--sidebar-width-icon)+1px)]! border-r">
        <SidebarHeader>
          <SidebarLogo />
        </SidebarHeader>
        <SidebarSeparator />
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent className="px-1.5 md:px-0">
              <OrganizationRail />
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <NavUser user={user} />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      {/* This is the second sidebar */}
      {/* We disable collapsible and let it fill remaining space */}
      <Sidebar collapsible="none" className="hidden flex-1 md:flex">
        <SidebarHeader className="gap-3.5 border-b p-4">
          <WorkspaceSwitch />
          <SidebarInput placeholder="Type to search..." />
        </SidebarHeader>
        <SidebarContent>
          <NavMain title="Overview" items={menu.navMenu.overview} />
          <NavMain title="Storage" items={menu.navMenu.storage} />
          {menu.navSetting.length > 0 && <NavMain title="Settings" items={menu.navSetting} />}
        </SidebarContent>
      </Sidebar>
    </Sidebar>
  )
}

function SidebarLogo() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" asChild className="md:h-8 md:p-0">
          <Link href="https://cloudrive.us.ci">
            <Image
              src="/static/images/cloudrive-logo-transparant.png"
              width={40}
              height={40}
              alt="brand logo"
            />
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">Cloudrive</span>
              <span className="truncate text-xs">Enterprise</span>
            </div>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
