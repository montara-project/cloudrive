'use client'

import { IconCloud } from '@tabler/icons-react'
import Link from 'next/link'

import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { useStorageUsage } from '@/hooks/use-storage-usage'
import { useWorkspaceContext } from '@/hooks/use-workspace-context'
import { formatBytes } from '@/lib/format'

/**
 * Sidebar storage summary — the workspace's connected accounts with their
 * aggregated provider quota (when reportable). Links into /storage keeping
 * the active org/workspace context, same as NavMain scoped links.
 */
export default function NavStorageCard() {
  const { wsId, orgId } = useWorkspaceContext()
  const { accounts, isLoading, used, total, hasUsage } = useStorageUsage(wsId ?? undefined)

  if (!wsId) return null

  const percent = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0

  const params = new URLSearchParams()
  if (orgId) params.set('org', orgId)
  params.set('ws', wsId)
  const href = `/storage?${params.toString()}`

  return (
    <Link
      href={href}
      className="block rounded-xl border border-sidebar-border bg-background/70 p-3 transition-colors hover:bg-background"
    >
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <IconCloud className="size-4.5" />
        </div>
        <span className="flex-1 truncate text-sm font-medium text-sidebar-foreground">Storage</span>
        <span className="rounded-full bg-sidebar-accent px-2 py-0.5 text-[11px] font-medium tabular-nums text-sidebar-accent-foreground">
          {isLoading ? '…' : hasUsage ? `${percent}%` : accounts.length}
        </span>
      </div>

      {isLoading ? (
        <Skeleton className="mt-3 h-1.5 w-full rounded-full" />
      ) : hasUsage ? (
        <Progress value={percent} className="mt-3 h-1.5 bg-sidebar-accent" />
      ) : null}

      <p className="mt-2.5 truncate text-xs text-muted-foreground">
        {isLoading
          ? 'Loading accounts…'
          : hasUsage
            ? `${formatBytes(used)} of ${formatBytes(total)} used`
            : `${accounts.length} account${accounts.length === 1 ? '' : 's'} connected`}
      </p>
    </Link>
  )
}
