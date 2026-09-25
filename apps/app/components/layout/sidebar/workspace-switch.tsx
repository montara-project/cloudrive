'use client'

import { IconPlus, IconStack2 } from '@tabler/icons-react'
import { Check, ChevronsUpDown, LayoutGrid } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { AddWorkspaceForm } from '@/components/block/workspaces/form'
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

/**
 * Workspace switcher for the sidebar header.
 *
 * Selecting a workspace writes the `ws` (and `org`) query params, which is the
 * same context the storage/S3 pages read — one click scopes the whole app
 * instead of re-picking the workspace inside every page.
 */
export default function WorkspaceSwitch() {
  const { isMobile } = useSidebar()
  const { organization, orgId, workspace, workspaces, isLoading, selectWorkspace } =
    useWorkspaceContext()
  const [openAdd, setOpenAdd] = useState(false)

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              tooltip={workspace?.name ?? 'Workspace'}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-sidebar-accent text-sidebar-accent-foreground">
                <IconStack2 className="size-3.5" />
              </div>
              {isLoading ? (
                <Skeleton className="h-3.5 w-24" />
              ) : (
                <span className="truncate font-medium">
                  {workspace?.name ?? (orgId ? 'No workspace' : 'No organization')}
                </span>
              )}
              <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-70" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-60 rounded-lg"
            align="start"
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuLabel className="truncate text-xs text-muted-foreground">
              {organization ? `Workspaces in ${organization.name}` : 'Workspaces'}
            </DropdownMenuLabel>

            {workspaces.map((item) => (
              <DropdownMenuItem
                key={item.id}
                className="gap-2 p-2"
                onClick={() => selectWorkspace(item.id)}
              >
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate">{item.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{item.slug}</span>
                </div>
                {item.id === workspace?.id && <Check className="size-4 shrink-0" />}
              </DropdownMenuItem>
            ))}

            {!isLoading && orgId && workspaces.length === 0 && (
              <div className="px-2 py-3 text-xs text-muted-foreground">
                No workspace in this organization yet.
              </div>
            )}

            {!isLoading && !orgId && (
              <div className="px-2 py-3 text-xs text-muted-foreground">
                Create an organization first.
              </div>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="gap-2 p-2"
              disabled={!orgId}
              onClick={() => setOpenAdd(true)}
            >
              <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                <IconPlus className="size-4" />
              </div>
              <span className="font-medium text-muted-foreground">New workspace</span>
            </DropdownMenuItem>

            <DropdownMenuItem className="gap-2 p-2" asChild>
              <Link href="/settings?tab=workspaces">
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <LayoutGrid className="size-4" />
                </div>
                <span className="font-medium text-muted-foreground">Manage workspaces</span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {orgId && (
          <AddWorkspaceForm
            orgId={orgId}
            open={openAdd}
            onOpenChange={setOpenAdd}
            onCreated={(ws) => {
              selectWorkspace(ws.id)
              setOpenAdd(false)
            }}
          />
        )}
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
