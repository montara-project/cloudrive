import { IconPlus, IconStack2 } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'
import { Check, ChevronDown, LayoutGrid } from 'lucide-react'
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
import { useWorkspaceContext } from '@/hooks/use-workspace-context'

/**
 * Workspace switcher in the main sidebar header: a single-line select showing
 * the active workspace, with pick / create / manage in the dropdown. The
 * account menu lives in the top bar (UserMenu). Selecting a workspace
 * writes the `ws` (and `org`) query params — the same context the storage/S3
 * pages and the Folders group read — so one click scopes the whole app.
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
          aria-label="Workspace menu"
          className="flex h-10 w-full cursor-pointer items-center gap-2 rounded-lg bg-sidebar-accent px-3 text-left text-sm font-medium text-sidebar-accent-foreground transition-colors hover:bg-sidebar-accent/80"
        >
          <span className="flex-1 truncate">
            {isLoading
              ? 'Loading…'
              : (workspace?.name ?? (orgId ? 'No workspace' : 'No organization'))}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
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
          <div className="flex size-6 shrink-0 items-center justify-center rounded-md border bg-transparent">
            <IconPlus className="size-4" />
          </div>
          <span className="font-medium text-muted-foreground">New workspace</span>
        </DropdownMenuItem>

        <DropdownMenuItem className="gap-2 p-2" asChild>
          <Link to="/settings" search={{ tab: 'workspaces' }}>
            <div className="flex size-6 shrink-0 items-center justify-center rounded-md border bg-transparent">
              <LayoutGrid className="size-3.5" />
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
