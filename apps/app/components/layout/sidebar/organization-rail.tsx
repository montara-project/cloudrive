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

  const renderItem = (org: Models.Organization) => (
    <SidebarMenuItem key={org.id}>
      <Tooltip>
        <TooltipTrigger asChild>
          <SidebarMenuButton
            size="lg"
            isActive={org.id === organization?.id}
            onClick={() => selectOrganization(org.id)}
            className="justify-center md:h-9 md:p-0"
          >
            <Avatar className="size-8 rounded-lg">
              {org.logo && <AvatarImage src={org.logo} alt={org.name} />}
              <AvatarFallback className="rounded-lg">
                {(org.name[0] ?? 'O').toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </SidebarMenuButton>
        </TooltipTrigger>
        <TooltipContent side="right">{org.name}</TooltipContent>
      </Tooltip>
    </SidebarMenuItem>
  )

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
