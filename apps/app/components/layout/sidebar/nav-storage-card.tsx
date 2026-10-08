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
      className="block rounded-2xl border border-sidebar-border bg-sidebar p-3.5 shadow-xs transition-colors hover:bg-sidebar-accent/40"
    >
      <div className="flex items-center gap-2.5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <IconCloud className="size-5" />
        </div>
        <span className="flex-1 truncate text-sm font-semibold text-sidebar-foreground">
          Storage
        </span>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-primary">
          {isLoading ? '…' : hasUsage ? `${percent}%` : accounts.length}
        </span>
      </div>

      {isLoading ? (
        <Skeleton className="mt-3.5 h-1.5 w-full rounded-full" />
      ) : (
        <Progress
          value={hasUsage ? percent : 0}
          className="mt-3.5 h-1.5 bg-sidebar-accent"
          indicatorClassName="bg-primary"
        />
      )}

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
