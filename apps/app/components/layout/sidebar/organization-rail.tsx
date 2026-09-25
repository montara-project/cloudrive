'use client'

import { IconPlus } from '@tabler/icons-react'
import { useState } from 'react'

import type { Models } from '@/lib/api/models'

import { AddOrganizationForm } from '@/components/block/organizations/form'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useWorkspaceContext } from '@/hooks/use-workspace-context'
import { cn } from '@/lib/utils'

/**
 * Vertical organization list for the icon rail — one avatar button per
 * organization; clicking scopes the whole app to it via the `org` query
 * param (same context WorkspaceSwitch and the scoped pages read).
 *
 * SidebarMenuButton's built-in `tooltip` prop is suppressed unless the
 * sidebar state is `collapsed`, but this rail is always icon-width while the
 * outer sidebar stays expanded — so items use an explicit Tooltip instead.
 */
export default function OrganizationRail() {
  const { organizations, organization, isLoading, selectOrganization } = useWorkspaceContext()
  const [openAdd, setOpenAdd] = useState(false)

  const renderItem = (org: Models.Organization) => {
    const active = org.id === organization?.id

    return (
      <SidebarMenuItem key={org.id} className="relative">
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarMenuButton
              size="lg"
              isActive={active}
              onClick={() => selectOrganization(org.id)}
              className="justify-center md:h-9 md:p-0"
            >
              <Avatar className={cn('size-8 rounded-lg', active && 'ring-primary')}>
                {org.logo && <AvatarImage src={org.logo} alt={org.name} />}
                <AvatarFallback className="rounded-lg">
                  {(org.name[0] ?? 'O').toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </SidebarMenuButton>
          </TooltipTrigger>
          <TooltipContent side="right">{org.name}</TooltipContent>
        </Tooltip>
        {/* Indicator bar on the rail edge — the `isActive` tint alone is too
            subtle at icon width to tell which organization is selected. */}
        {active && (
          <span className="pointer-events-none absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
        )}
      </SidebarMenuItem>
    )
  }

  return (
    <>
      <SidebarMenu className="gap-1">
        {isLoading
          ? Array.from({ length: 3 }, (_, i) => (
              <SidebarMenuItem key={i}>
                <Skeleton className="mx-auto size-8 rounded-lg" />
              </SidebarMenuItem>
            ))
          : organizations.map(renderItem)}
        <SidebarMenuItem>
          <Tooltip>
            <TooltipTrigger asChild>
              <SidebarMenuButton
                size="lg"
                onClick={() => setOpenAdd(true)}
                className="justify-center md:h-9 md:p-0 text-muted-foreground"
              >
                <IconPlus className="size-4" />
              </SidebarMenuButton>
            </TooltipTrigger>
            <TooltipContent side="right">Add organization</TooltipContent>
          </Tooltip>
        </SidebarMenuItem>
      </SidebarMenu>

      <AddOrganizationForm open={openAdd} onOpenChange={setOpenAdd} />
    </>
  )
}
