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
import { Skeleton } from '@/components/ui/skeleton'
import { useWorkspaceContext } from '@/hooks/use-workspace-context'

/**
 * Workspace selector card at the top of the main sidebar. Selecting a
 * workspace writes the `ws` (and `org`) query params — the same context the
 * storage/S3 pages and the Folders group read — so one click scopes the whole
 * app instead of re-picking the workspace inside every page.
 */
export default function WorkspaceSelect() {
  const { organization, orgId, workspace, workspaces, isLoading, selectWorkspace } =
    useWorkspaceContext()
  const [openAdd, setOpenAdd] = useState(false)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-sidebar-border bg-background p-2 text-left shadow-xs transition-colors hover:bg-accent/60 data-[state=open]:bg-accent/60"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <IconStack2 className="size-4.5" />
          </span>
          <span className="grid min-w-0 flex-1 leading-tight">
            {isLoading ? (
              <Skeleton className="h-4 w-28" />
            ) : (
              <span className="truncate text-sm font-semibold">
                {workspace?.name ?? (orgId ? 'No workspace' : 'No organization')}
              </span>
            )}
            <span className="truncate text-xs text-muted-foreground">
              {organization ? organization.name : 'Select an organization'}
            </span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="min-w-(--radix-dropdown-menu-trigger-width) rounded-xl"
        align="start"
        sideOffset={6}
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
            <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <IconStack2 className="size-3.5" />
            </div>
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

        <DropdownMenuItem className="gap-2 p-2" disabled={!orgId} onClick={() => setOpenAdd(true)}>
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
    </DropdownMenu>
  )
}
