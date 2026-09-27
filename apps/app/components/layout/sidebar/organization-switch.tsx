'use client'

import { IconPlus } from '@tabler/icons-react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { useState } from 'react'

import { AddOrganizationForm } from '@/components/block/organizations/form'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { useWorkspaceContext } from '@/hooks/use-workspace-context'
import { Models } from '@/lib/api/models'

function OrganizationLogo({ org, className }: { org?: Models.Organization; className?: string }) {
  return (
    <Avatar className={className}>
      {org?.logo && <AvatarImage src={org.logo} alt={org.name} />}
      <AvatarFallback>{(org?.name?.[0] ?? 'O').toUpperCase()}</AvatarFallback>
    </Avatar>
  )
}

export default function OrganizationSwitch() {
  const { isMobile } = useSidebar()
  const { organizations, organization, isLoading, selectOrganization } = useWorkspaceContext()
  const [openAdd, setOpenAdd] = useState(false)

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              tooltip={organization?.name ?? 'Organization'}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              {isLoading ? (
                <Skeleton className="size-8 shrink-0 rounded-lg" />
              ) : (
                <OrganizationLogo
                  org={organization}
                  className="size-8 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"
                />
              )}
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {organization?.name ?? 'No organization'}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {organization ? `@${organization.slug}` : 'Create one to get started'}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Organizations
            </DropdownMenuLabel>
            {organizations.map((item) => (
              <DropdownMenuItem
                key={item.id}
                className="gap-2 p-2"
                onClick={() => selectOrganization(item.id)}
              >
                <OrganizationLogo org={item} className="size-6 rounded-md border" />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate">{item.name}</span>
                  <span className="truncate text-xs text-muted-foreground">@{item.slug}</span>
                </div>
                {item.id === organization?.id && <Check className="size-4 shrink-0" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 p-2" onClick={() => setOpenAdd(true)}>
              <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                <IconPlus className="size-4" />
              </div>
              <div className="font-medium text-muted-foreground">Add organization</div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <AddOrganizationForm open={openAdd} onOpenChange={setOpenAdd} />
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
