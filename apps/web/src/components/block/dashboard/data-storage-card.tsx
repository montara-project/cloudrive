import { IconInfoCircle } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'

import { MOCK_STORAGE_SEGMENTS, MOCK_STORAGE_TOTAL } from '@/data/mock/dashboard'
import { formatBytes } from '@/lib/format'

/**
 * Data Storage card — the file-type breakdown of the workspace quota as a
 * single segmented bar with its legend. Segments come from the mock fixtures
 * (one per file family); free space is derived from the 1 TB quota.
 */
export default function DataStorageCard() {
  const used = MOCK_STORAGE_SEGMENTS.reduce((sum, segment) => sum + segment.bytes, 0)
  const free = MOCK_STORAGE_TOTAL - used

  return (
    <section className="rounded-xl border bg-card shadow-xs">
      <div className="flex items-center justify-between px-5 pt-4">
        <h2 className="text-base font-semibold tracking-tight">Data Storage</h2>
      </div>

      <div className="px-5 pt-4">
        <div
          className="flex h-3 gap-1"
          role="img"
          aria-label={`${formatBytes(used)} of ${formatBytes(MOCK_STORAGE_TOTAL)} used`}
        >
          {MOCK_STORAGE_SEGMENTS.map((segment) => (
            <span
              key={segment.label}
              className={`h-3 rounded-full ${segment.colorClass}`}
              style={{ flexGrow: segment.bytes, flexBasis: 0 }}
            />
          ))}
          <span
            className="h-3 grow basis-0 rounded-full bg-zinc-100 dark:bg-zinc-800"
            style={{ flexGrow: free }}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
          {MOCK_STORAGE_SEGMENTS.map((segment) => (
            <span key={segment.label} className="flex items-center gap-2 text-sm">
              <span className={`size-2.5 rounded-full ${segment.colorClass}`} aria-hidden="true" />
              <span className="text-muted-foreground">{segment.label}</span>
              <span className="font-semibold tabular-nums">{formatBytes(segment.bytes)}</span>
            </span>
          ))}
          <span className="flex items-center gap-2 text-sm">
            <span
              className="size-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800"
              aria-hidden="true"
            />
            <span className="text-muted-foreground">Free Space</span>
            <span className="font-semibold tabular-nums">{formatBytes(free)}</span>
          </span>
          <span className="ml-auto text-sm text-muted-foreground">
            <span className="font-semibold tabular-nums text-foreground">{formatBytes(used)}</span>{' '}
            of <span className="font-semibold tabular-nums">{formatBytes(MOCK_STORAGE_TOTAL)}</span>{' '}
            used
          </span>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t px-5 py-3.5 text-sm text-muted-foreground">
        <IconInfoCircle className="size-4 shrink-0" />
        <p>
          Running low on space? Get more storage when you need it.{' '}
          <Link
            to="/storage"
            className="font-semibold text-foreground underline underline-offset-4 hover:text-primary"
          >
            Upgrade Now
          </Link>
        </p>
      </div>
    </section>
  )
}
