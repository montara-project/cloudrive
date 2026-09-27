import { IconCheck } from '@tabler/icons-react'

export type Role = 'admin'

/**
 * Which slice of the app a nav entry belongs to — decides whether the sidebar
 * appends the active organization / workspace to its link.
 */
export type NavScope = 'organization' | 'workspace'

export type NavSubItem = {
  title: string
  url: string
  icon?: typeof IconCheck
  scope?: NavScope
}

export type NavMainItem = {
  title: string
  url: string
  icon: typeof IconCheck
  isActive?: boolean
  items: NavSubItem[]
  scope?: NavScope
}

export type UserInfo = {
  name: string
  email: string
  avatar: string
}

export type SidebarMenuData = {
  user: UserInfo
  navMenu: {
    overview: NavMainItem[]
    storage: NavMainItem[]
  }
  navSetting: NavMainItem[]
}
