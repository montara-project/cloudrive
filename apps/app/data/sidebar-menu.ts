import {
  IconBucket,
  IconClock,
  IconCloud,
  IconFolder,
  IconHome,
  IconPackages,
  IconSettings,
  IconStar,
  IconUsers,
} from '@tabler/icons-react'

import type { NavMainItem, SidebarMenuData } from '@/types/menu'

// ── Sidebar menus — mapped to the API surface in apps/server routes.go ──
//
// `scope` marks entries that are meaningless without an active
// organization/workspace; NavMain appends the current context to their links
// so a click keeps the selection instead of dropping the user on an empty page.

/**
 * The Drive group: Home is the workspace overview, the middle four are ways of
 * slicing the same merged drive (everything, shared, recent, starred), and
 * Storage covers the connected accounts and their quotas.
 *
 * Every entry but Home is workspace-scoped — the drive and its listings are a
 * provider fan-out per workspace, so a link without `ws` would land on an
 * empty page.
 */
const NAV_DRIVE: NavMainItem[] = [
  {
    title: 'Home',
    url: '/dashboard',
    icon: IconHome,
    isActive: false,
    items: [],
  },
  {
    title: 'My Drive',
    url: '/drive',
    icon: IconFolder,
    isActive: false,
    scope: 'workspace',
    items: [],
  },
  {
    title: 'Shared',
    url: '/shared',
    icon: IconUsers,
    isActive: false,
    scope: 'workspace',
    items: [],
  },
  {
    title: 'Recent',
    url: '/recent',
    icon: IconClock,
    isActive: false,
    scope: 'workspace',
    items: [],
  },
  {
    title: 'Starred',
    url: '/starred',
    icon: IconStar,
    isActive: false,
    scope: 'workspace',
    items: [],
  },
  {
    title: 'Storage',
    url: '/storage',
    icon: IconCloud,
    isActive: false,
    scope: 'workspace',
    items: [],
  },
]

/**
 * Secondary destinations. Providers and the S3 gateway are configuration
 * rather than places to browse, so they sit outside the Drive group — but they
 * keep their entries so no routed page disappears from the sidebar.
 */
const NAV_SETTINGS: NavMainItem[] = [
  {
    title: 'Providers',
    url: '/providers',
    icon: IconPackages,
    isActive: false,
    items: [],
  },
  {
    title: 'S3 Gateway',
    url: '/s3',
    icon: IconBucket,
    isActive: false,
    scope: 'workspace',
    items: [],
  },
  {
    title: 'Settings',
    url: '/settings',
    icon: IconSettings,
    isActive: false,
    items: [],
  },
]

export const SIDEBAR_MENU: SidebarMenuData = {
  user: {
    name: 'User',
    email: '',
    avatar: '',
  },
  navDrive: NAV_DRIVE,
  navSetting: NAV_SETTINGS,
}
