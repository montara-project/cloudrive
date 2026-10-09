'use client'

import { IconCloudUp, IconPlugConnected } from '@tabler/icons-react'

import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { useStorageUsage } from '@/hooks/use-storage-usage'
import { useWorkspaceContext } from '@/hooks/use-workspace-context'
import { formatBytes } from '@/lib/format'
import { cn } from '@/lib/utils'

import AccountCard, { USAGE_PALETTE } from './account-card'

type StorageOverviewProps = {
  /** Opens the workspace's connect-account dialog (header button or empty-state CTA). */
  onConnect: () => void
}

/**
 * StorageOverview is the overview body — total usage card plus the connected
 * account grid — shared by the /storage page and the Settings → Storage tab.
 * Page chrome (title, actions) belongs to the caller.
 */
export default function StorageOverview({ onConnect }: StorageOverviewProps) {
  const { wsId } = useWorkspaceContext()
  const { accounts, usage, providerById, used, total, hasUsage, isLoading } = useStorageUsage(
    wsId ?? undefined
  )

  // Segment colors must match each card's color, so index against the full
  // accounts list before filtering to accounts that reported usage.
  const usageSegments = accounts
    .map((account, index) => ({
      account,
      color: USAGE_PALETTE[index % USAGE_PALETTE.length],
    }))
    .filter(({ account }) => usage.has(account.id))
    .map(({ account, color }) => ({
      account,
      color,
      percent: (usage.get(account.id)!.used / usage.get(account.id)!.total) * 100,
    }))

  if (!wsId) {
    return (
      <Empty className="rounded-2xl border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconCloudUp />
          </EmptyMedia>
          <EmptyTitle>No workspace selected</EmptyTitle>
          <EmptyDescription>
            Pick a workspace in the sidebar to manage its storage accounts.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-44 rounded-2xl" />
        ))}
      </div>
    )
  }

  if (accounts.length === 0) {
    return (
      <Empty className="rounded-2xl border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconCloudUp />
          </EmptyMedia>
          <EmptyTitle>No accounts connected yet</EmptyTitle>
          <EmptyDescription>
            Connect your first cloud provider to see its usage here.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="primary" className="rounded-full" onClick={onConnect}>
            <IconPlugConnected className="size-4" /> Connect account
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {hasUsage && (
        <div className="rounded-2xl border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <IconCloudUp className="size-5.5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total storage</p>
                <p className="text-xl font-semibold tabular-nums">
                  {formatBytes(used)}{' '}
                  <span className="text-sm font-normal text-muted-foreground">
                    / {formatBytes(total)}
                  </span>
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm tabular-nums">
              <span className="text-muted-foreground">Used space</span>
              <span className="text-right font-medium">{formatBytes(used)}</span>
              <span className="text-muted-foreground">Free space</span>
              <span className="text-right font-medium">{formatBytes(total - used)}</span>
            </div>
          </div>
          <div className="mt-4 flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-muted">
            {usageSegments.map(({ account, percent: segment, color }) => (
              <div
                key={account.id}
                className={cn('h-full first:rounded-l-full last:rounded-r-full', color)}
                style={{ width: `${Math.max(1, segment)}%` }}
              />
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {accounts.map((account, index) => (
          <AccountCard
            key={account.id}
            account={account}
            provider={providerById.get(account.provider_id)}
            usage={usage.get(account.id)}
            color={USAGE_PALETTE[index % USAGE_PALETTE.length]}
            wsId={wsId}
          />
        ))}
      </div>
    </div>
  )
}
