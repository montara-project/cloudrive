import { IconRocket } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'

import { Skeleton } from '@/components/ui/skeleton'
import { useStorageUsage } from '@/hooks/use-storage-usage'
import { useWorkspaceContext } from '@/hooks/use-workspace-context'
import { formatBytes } from '@/lib/format'
import { hrefToLocation } from '@/lib/utils'

const TICKS = 18

/**
 * Sidebar footer card — the "Keep Your Files Growing" upgrade prompt. Usage
 * comes from the real storage hook (provider-reported quotas; `?mockQuota`
 * fills preview data in dev), with the segmented tick bar showing how full
 * the quota is. Links into /storage keeping the active context.
 */
export default function NavStorageCard() {
  const { wsId, orgId } = useWorkspaceContext()
  const { isLoading, used, total, hasUsage } = useStorageUsage(wsId ?? undefined)

  if (!wsId) return null

  const percent = total > 0 ? Math.min(100, used / total) : 0
  const filled = Math.round(percent * TICKS)

  const params = new URLSearchParams()
  if (orgId) params.set('org', orgId)
  params.set('ws', wsId)
  const href = `/storage?${params.toString()}`

  return (
    <Link
      {...hrefToLocation(href)}
      className="block overflow-hidden rounded-2xl border border-sidebar-border bg-background shadow-xs transition-colors hover:bg-accent/40"
    >
      <div className="relative h-16 bg-gradient-to-br from-primary/20 via-primary/5 to-sky-400/25">
        <span className="absolute top-3 left-3 flex size-9 items-center justify-center rounded-lg border border-sidebar-border bg-background text-primary shadow-xs">
          <IconRocket className="size-4.5" />
        </span>
      </div>

      <div className="p-4 pt-3">
        <p className="text-sm font-semibold">Keep Your Files Growing</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Need more room? Upgrade your plan and store more without limits.
        </p>

        {isLoading ? (
          <Skeleton className="mt-3.5 h-3.5 w-full rounded-full" />
        ) : (
          <div className="mt-3.5 flex gap-[3px]" aria-hidden="true">
            {Array.from({ length: TICKS }, (_, index) => (
              <span
                key={index}
                className={`h-3.5 flex-1 rounded-full ${
                  index < filled ? 'bg-primary' : 'bg-primary/15'
                }`}
              />
            ))}
          </div>
        )}

        <p className="mt-2.5 truncate text-xs text-muted-foreground">
          {isLoading ? (
            'Loading usage…'
          ) : hasUsage ? (
            <>
              <span className="font-semibold text-foreground">{formatBytes(total - used)}</span>{' '}
              left from <span className="font-semibold text-foreground">{formatBytes(total)}</span>
            </>
          ) : (
            'Connect an account to see usage'
          )}
        </p>

        <span className="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-zinc-950 text-sm font-medium text-white transition-colors hover:bg-zinc-950/90 dark:bg-zinc-300 dark:text-black dark:hover:bg-zinc-300/90">
          Expand Storage
        </span>
      </div>
    </Link>
  )
}
