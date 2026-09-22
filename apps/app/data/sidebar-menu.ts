import {
  IconBucket,
  IconBuilding,
  IconCloud,
  IconLayoutDashboard,
  IconPackages,
  IconSettings,
  IconStack2,
} from '@tabler/icons-react'

import type { NavMainItem, SidebarMenuData } from '@/types/menu'

// ── Sidebar menus — mapped to the API surface in apps/server routes.go ──

const NAV_OVERVIEW: NavMainItem[] = [
  {
    title: 'Dashboard',
    url: '/dashboard',
    icon: IconLayoutDashboard,
    isActive: true,
    items: [],
  },
]

const NAV_MANAGE: NavMainItem[] = [
  {
    title: 'Organizations',
    url: '/organizations',
    icon: IconBuilding,
    isActive: false,
    items: [],
  },
  {
    title: 'Workspaces',
    url: '/workspaces',
    icon: IconStack2,
    isActive: false,
    items: [],
  },
]

const NAV_STORAGE: NavMainItem[] = [
  {
    title: 'Providers',
    url: '/providers',
    icon: IconPackages,
    isActive: false,
    items: [],
  },
  {
    title: 'Storage Accounts',
    url: '/storage',
    icon: IconCloud,
    isActive: false,
    items: [],
  },
  {
    title: 'S3 Gateway',
    url: '/s3',
    icon: IconBucket,
    isActive: false,
    items: [],
  },
]

const NAV_SETTINGS: NavMainItem[] = [
  {
    title: 'Settings',
    url: '/settings',
    icon: IconSettings,
    isActive: false,
    items: [],
  },
]

const SIDEBAR_MENU: SidebarMenuData = {
  user: {
    name: 'User',
    email: '',
    avatar: '',
  },
  teams: [],
  navMenu: {
    overview: NAV_OVERVIEW,
    manage: NAV_MANAGE,
    storage: NAV_STORAGE,
  },
  navSetting: NAV_SETTINGS,
}

// ── Lookup ─────────────────────────────────────────────────────────────

export function getSidebarMenu(): SidebarMenuData {
  return SIDEBAR_MENU
}
