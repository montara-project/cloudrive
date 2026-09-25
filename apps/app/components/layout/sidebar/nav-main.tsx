'use client'

import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar'
import { useWorkspaceContext } from '@/hooks/use-workspace-context'
import { type NavMainItem, type NavScope } from '@/types/menu'

type NavMainProps = {
  title: string
  items: NavMainItem[]
}

export default function NavMain({ title, items }: NavMainProps) {
  const pathname = usePathname()
  const { orgId, wsId } = useWorkspaceContext()

  /**
   * Keep the active organization/workspace in scoped links so navigating never
   * resets the context the header displays.
   */
  const scopedHref = (url: string, scope?: NavScope) => {
    const params = new URLSearchParams()

    if ((scope === 'organization' || scope === 'workspace') && orgId) params.set('org', orgId)
    if (scope === 'workspace' && wsId) params.set('ws', wsId)

    const query = params.toString()
    return query ? `${url}?${query}` : url
  }

  const isActive = (url: string) => pathname === url || pathname.startsWith(`${url}/`)

  const renderSidebarMenu = (item: NavMainItem) => {
    if (item.items.length === 0) {
      return (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton tooltip={item.title} asChild isActive={isActive(item.url)}>
            <Link href={scopedHref(item.url, item.scope)}>
              {item.icon && <item.icon />}
              <span>{item.title}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      )
    }

    const groupActive = item.items.some((sub) => isActive(sub.url))

    return (
      <Collapsible
        key={item.title}
        asChild
        defaultOpen={item.isActive || groupActive}
        className="group/collapsible"
      >
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton tooltip={item.title} isActive={groupActive}>
              {item.icon && <item.icon />}
              <span>{item.title}</span>
              <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {item.items.map((subItem) => (
                <SidebarMenuSubItem key={subItem.title}>
                  <SidebarMenuSubButton asChild isActive={isActive(subItem.url)}>
                    <Link href={scopedHref(subItem.url, subItem.scope ?? item.scope)}>
                      {subItem.icon && <subItem.icon />}
                      <span>{subItem.title}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    )
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-muted-foreground text-xs">{title}</SidebarGroupLabel>
      <SidebarMenu>{items.map((item) => renderSidebarMenu(item))}</SidebarMenu>
    </SidebarGroup>
  )
}
