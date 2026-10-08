'use client'

import { IconUsers } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { useSession } from '@/hooks/use-session'
import { useWorkspaceContext } from '@/hooks/use-workspace-context'
import { queries } from '@/lib/api/queries'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
}

/**
 * SharedContent shows who can reach the workspace's drive. Sharing today is
 * workspace membership — there are no per-file ACLs server side — so this is
 * the honest answer to "what have I shared, and with whom": the people and
 * their roles, with the current user marked.
 *
 * The member listing carries only user ids, so the rows render an initial plus
 * the role, and call out the signed-in user when they are on the list.
 */
export default function SharedContent() {
  const { wsId, workspace } = useWorkspaceContext()
  const { data: session } = useSession()

  const membersQuery = useQuery(queries.workspaces.members.list(wsId, { limit: 100 }))
  const members = useMemo(() => membersQuery.data?.data ?? [], [membersQuery.data])

  if (!wsId) {
    return (
      <Empty className="rounded-2xl border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconUsers />
          </EmptyMedia>
          <EmptyTitle>No workspace selected</EmptyTitle>
          <EmptyDescription>
            Pick a workspace in the sidebar to see who it is shared with.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <IconUsers className="size-5.5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Shared</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {workspace
              ? `People with access to ${workspace.name} and the drive inside it.`
              : 'People with access to this workspace and the drive inside it.'}
          </p>
        </div>
      </div>

      {membersQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <Empty className="rounded-2xl border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <IconUsers />
            </EmptyMedia>
            <EmptyTitle>Only you, so far</EmptyTitle>
            <EmptyDescription>
              Add teammates to this workspace from Settings → Workspaces to share the drive.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {members.map((member) => {
            const isCurrentUser = member.user_id === session?.user.id
            const role = ROLE_LABELS[member.role] ?? member.role

            return (
              <Card key={member.id} className="rounded-2xl">
                <CardContent className="flex items-center gap-3">
                  <Avatar className="size-10 rounded-xl">
                    <AvatarImage src={isCurrentUser ? session?.user.image : undefined} alt={role} />
                    <AvatarFallback className="rounded-xl">
                      {(isCurrentUser
                        ? (session?.user.first_name?.[0] ?? session?.user.email[0])
                        : member.user_id[0]
                      )?.toUpperCase() ?? 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {isCurrentUser ? `You (${session?.user.email})` : `Member ${member.user_id}`}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{role}</p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
