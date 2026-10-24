'use client'

import { PanelLeft } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'

import GlobalSearch from '@/components/layout/global-search'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar'
import { SIDEBAR_MENU } from '@/data/sidebar-menu'

import NavFolders from './nav-folders'
import NavMain from './nav-main'
import NavStorageCard from './nav-storage-card'
import OrganizationRail from './organization-rail'
import WorkspaceSelect from './workspace-switch'

type AppSidebarProps = React.ComponentProps<typeof Sidebar>

/**
 * The redesigned shell: a slim organization rail (logo, org switcher, collapse
 * toggle) beside the main sidebar (workspace selector, search, main menu,
 * workspace folders, utilities, upgrade card). The account menu lives in the
 * top bar (UserMenu), not the sidebar.
 */
export default function AppSidebar(props: AppSidebarProps) {
  const menu = SIDEBAR_MENU

  return (
    <Sidebar
      collapsible="icon"
      className="overflow-hidden *:data-[sidebar=sidebar]:flex-row"
      {...props}
    >
      {/* Organization rail — always icon width, holds the org switcher */}
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
          <RailCollapseButton />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      {/* Main sidebar */}
      <Sidebar collapsible="none" className="hidden flex-1 md:flex">
        <SidebarHeader className="gap-3 p-4">
          <WorkspaceSelect />
          <GlobalSearch />
        </SidebarHeader>
        <SidebarContent>
          <NavMain title="Main Menu" items={menu.navDrive} />
          <NavFolders />
          {menu.navSetting.length > 0 && <NavMain title="Other" items={menu.navSetting} />}
        </SidebarContent>
        <SidebarFooter className="p-3 pb-4">
          <NavStorageCard />
        </SidebarFooter>
      </Sidebar>
    </Sidebar>
  )
}

function SidebarLogo() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" asChild className="md:h-8 md:p-0">
          <Link href="/">
            <Image src="/static/images/cloudrive.png" width={40} height={40} alt="brand logo" />
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

/**
 * Rail footer toggle — collapses the main sidebar panel, leaving the
 * organization rail. The rail edge (SidebarRail) does the same.
 */
function RailCollapseButton() {
  const { toggleSidebar } = useSidebar()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          onClick={toggleSidebar}
          tooltip="Collapse sidebar"
          className="justify-center md:h-8 md:p-0 text-muted-foreground"
        >
          <PanelLeft className="size-4.5" />
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
