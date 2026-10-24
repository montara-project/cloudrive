import { Link } from '@tanstack/react-router'
import { useLocation } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'

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
import { cn, hrefToLocation } from '@/lib/utils'
import { type NavMainItem, type NavScope } from '@/types/menu'

type NavMainProps = {
  title: string
  items: NavMainItem[]
}

/**
 * NavMain renders one sidebar section. Rows are flat by default; an entry with
 * `items` becomes a collapsible parent instead, kept because a nested entry's
 * own URL is not a destination the user can land on.
 */
export default function NavMain({ title, items }: NavMainProps) {
  const pathname = useLocation().pathname
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
          <SidebarMenuButton
            tooltip={item.title}
            asChild
            isActive={item.isActive || isActive(item.url)}
            className="h-9! gap-3 rounded-lg! border border-transparent text-[13.5px] font-medium! text-muted-foreground! hover:bg-sidebar-accent! hover:text-foreground! data-active:border-sidebar-border! data-active:bg-background! data-active:text-foreground! data-active:shadow-xs!"
          >
            <Link {...hrefToLocation(scopedHref(item.url, item.scope))}>
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
            <SidebarMenuButton
              tooltip={item.title}
              isActive={groupActive}
              className="h-9! gap-3 rounded-lg! border border-transparent text-[13.5px] font-medium! text-muted-foreground! hover:bg-sidebar-accent! hover:text-foreground! data-active:border-sidebar-border! data-active:bg-background! data-active:text-foreground! data-active:shadow-xs!"
            >
              {item.icon && <item.icon />}
              <span>{item.title}</span>
              <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {item.items.map((subItem) => (
                <SidebarMenuSubItem key={subItem.title}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={isActive(subItem.url)}
                    className="data-active:text-primary! data-active:[&>svg]:text-primary!"
                  >
                    <Link {...hrefToLocation(scopedHref(subItem.url, subItem.scope ?? item.scope))}>
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
    <SidebarGroup className={cn('gap-1 px-3 py-1.5')}>
      <SidebarGroupLabel className="h-7 px-2 text-[11px]! font-semibold tracking-wider text-muted-foreground/70! uppercase">
        {title}
      </SidebarGroupLabel>
      <SidebarMenu className="gap-0.5">{items.map((item) => renderSidebarMenu(item))}</SidebarMenu>
    </SidebarGroup>
  )
}
