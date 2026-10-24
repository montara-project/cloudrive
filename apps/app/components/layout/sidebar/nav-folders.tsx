'use client'

import { IconFolderFilled, IconPlus } from '@tabler/icons-react'
import { useState } from 'react'

import { AddWorkspaceForm } from '@/components/block/workspaces/form'
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useWorkspaceContext } from '@/hooks/use-workspace-context'

/**
 * FOLDERS — the active organization's workspaces rendered as folder entries.
 * Clicking one scopes the whole app to it via the shared `ws` param, replacing
 * the old workspace dropdown in the sidebar header. The group action creates a
 * workspace in the active organization.
 */
export default function NavFolders() {
  const { workspaces, workspace, isLoading, selectWorkspace, orgId } = useWorkspaceContext()
  const [openAdd, setOpenAdd] = useState(false)

  return (
    <SidebarGroup className="gap-1 px-3 py-1.5">
      <SidebarGroupLabel className="h-7 px-2 text-[11px]! font-semibold tracking-wider text-muted-foreground/70! uppercase">
        Folders
      </SidebarGroupLabel>
      {orgId && (
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarGroupAction
              onClick={() => setOpenAdd(true)}
              className="size-6 rounded-md border border-sidebar-border bg-background text-muted-foreground shadow-xs hover:text-foreground"
            >
              <IconPlus className="size-3.5" />
              <span className="sr-only">New workspace</span>
            </SidebarGroupAction>
          </TooltipTrigger>
          <TooltipContent side="right">New workspace</TooltipContent>
        </Tooltip>
      )}
      <SidebarMenu className="gap-0.5">
        {isLoading ? (
          Array.from({ length: 3 }, (_, index) => (
            <SidebarMenuItem key={index}>
              <SidebarMenuSkeleton className="h-9" />
            </SidebarMenuItem>
          ))
        ) : workspaces.length === 0 ? (
          <li className="px-2 py-1 text-xs text-muted-foreground">
            No folders yet — create one with the + button.
          </li>
        ) : (
          workspaces.map((item) => {
            const active = item.id === workspace?.id
            return (
              <SidebarMenuItem key={item.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={item.name}
                      onClick={() => selectWorkspace(item.id)}
                      className="h-9! gap-3 rounded-lg! border border-transparent text-[13.5px] font-medium! text-muted-foreground! hover:bg-sidebar-accent! hover:text-foreground! data-active:border-sidebar-border! data-active:bg-background! data-active:text-foreground! data-active:shadow-xs!"
                    >
                      <IconFolderFilled className="size-4.5 shrink-0 fill-amber-400 text-amber-500" />
                      <span className="truncate">{item.name}</span>
                    </SidebarMenuButton>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.name}</TooltipContent>
                </Tooltip>
              </SidebarMenuItem>
            )
          })
        )}
      </SidebarMenu>

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
    </SidebarGroup>
  )
}
