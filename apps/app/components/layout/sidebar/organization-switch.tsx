'use client'

import { IconPlus } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { ChevronsUpDown } from 'lucide-react'
import { useMemo, useState } from 'react'

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
import { Models } from '@/lib/api/models'
import { queries } from '@/lib/api/queries'

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

  const {
    data: orgs,
    isLoading,
    isFetching,
    isPending,
  } = useQuery(queries.organizations.list({ limit: 100 }))

  const loading = isLoading || isFetching || isPending

  const organizations = useMemo(
    () => (orgs?.data && orgs?.data?.length > 0 ? orgs.data : []),
    [orgs]
  )

  const [selected, setSelected] = useState<Models.Organization>()
  const activeOrganization = selected ?? organizations[0]

  const [openAdd, setOpenAdd] = useState(false)

  const renderOrganization = () => {
    if (loading) {
      return <div>Loading...</div>
    }

    return (
      <SidebarMenuButton
        size="lg"
        className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
      >
        <OrganizationLogo
          org={activeOrganization}
          className="size-8 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"
        />
        <div className="grid flex-1 text-left text-sm leading-tight">
          <span className="truncate font-medium">
            {activeOrganization ? activeOrganization.name : 'No organization'}
          </span>
          <span className="truncate text-xs">
            {activeOrganization ? `@${activeOrganization.slug}` : 'Create one to get started'}
          </span>
        </div>
        <ChevronsUpDown className="ml-auto" />
      </SidebarMenuButton>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>{renderOrganization()}</DropdownMenuTrigger>
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
                onClick={() => setSelected(item)}
              >
                <OrganizationLogo org={item} className="size-6 rounded-md border" />
                {item.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 p-2" onClick={() => setOpenAdd(true)}>
              <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                <IconPlus className="size-4" />
              </div>
              <div className="font-medium text-muted-foreground">Add Organization</div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <AddOrganizationForm open={openAdd} onOpenChange={setOpenAdd} />
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
