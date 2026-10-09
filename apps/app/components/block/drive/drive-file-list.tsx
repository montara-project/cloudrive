'use client'

import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

import ProviderIcon from '@/components/block/common/provider-icon'
import FileIcon from '@/components/block/dashboard/file-icon'
import { Skeleton } from '@/components/ui/skeleton'
import { useWorkspaceContext } from '@/hooks/use-workspace-context'
import { formatBytes } from '@/lib/format'

export type DriveFileRow = {
  /** Stable key — callers build it from whatever makes the row unique. */
  id: string
  /** Path or file name; the basename is what the row displays. */
  name: string
  size: number
  content_type?: string
  last_modified: string
  /** Where the file lives — the provider account, or the gateway bucket. */
  source_name: string
  provider_slug?: string
}

type DriveFileListProps = {
  files: DriveFileRow[]
  isLoading: boolean
  /** Rendered instead of the rows when the listing came back empty. */
  emptyMessage: string
  /** Trailing column label — "Bucket" for gateway listings, "Location" for drives. */
  sourceLabel?: string
  /** Built by the caller so the row lands on the object in its own context. */
  hrefFor: (file: DriveFileRow) => string
}

function basename(name: string) {
  const segments = name.split('/').filter(Boolean)
  return segments[segments.length - 1] ?? name
}

/**
 * DriveFileList renders one flat list of files with their origin, size and
 * age. It backs the Recent / Starred / Shared listings, which differ only in
 * where the rows come from — the query stays with the page so each view can
 * pick its own endpoint without the list knowing about it.
 */
export default function DriveFileList({
  files,
  isLoading,
  emptyMessage,
  sourceLabel = 'Location',
  hrefFor,
}: DriveFileListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4 p-5">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-lg" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    )
  }

  if (files.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">{emptyMessage}</p>
  }

  return (
    <div className="overflow-x-auto">
      <div role="table" className="min-w-[40rem] text-sm">
        <div className="flex items-center gap-3 border-b bg-muted/40 px-5 py-2.5 text-xs font-medium text-muted-foreground">
          <span className="flex-1">Name</span>
          <span className="hidden w-56 md:block">{sourceLabel}</span>
          <span className="w-36">Last modified</span>
          <span className="w-20 text-right">Size</span>
        </div>

        {files.map((file) => (
          <Link
            key={file.id}
            href={hrefFor(file)}
            className="flex items-center gap-3 border-b border-border/60 px-5 py-3 transition-colors last:border-b-0 hover:bg-muted/40"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <FileIcon fileName={file.name} contentType={file.content_type} />
              <div className="min-w-0">
                <p className="truncate font-medium">{basename(file.name)}</p>
                {/* Only worth a second line when the path adds information the
                    basename does not already show. */}
                {file.name !== basename(file.name) && (
                  <p className="truncate text-xs text-muted-foreground">{file.name}</p>
                )}
              </div>
            </div>

            <div className="hidden w-56 items-center gap-2 md:flex">
              <ProviderIcon slug={file.provider_slug} className="size-6 rounded-md" />
              <span className="truncate text-muted-foreground">{file.source_name}</span>
            </div>

            <span className="w-36 truncate text-muted-foreground">
              {formatDistanceToNow(new Date(file.last_modified), { addSuffix: true })}
            </span>

            <span className="w-20 text-right text-muted-foreground tabular-nums">
              {formatBytes(file.size)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

/**
 * useDriveFileHref builds the link back to a file's origin. Recent and Starred
 * list gateway objects, which live under their bucket's keys; the `s3` view
 * param keeps the destination tab stable so the row does not land on the
 * credentials tab by default.
 */
export function useDriveFileHref() {
  const { orgId, wsId } = useWorkspaceContext()

  return (bucket?: string) => {
    const params = new URLSearchParams()
    if (orgId) params.set('org', orgId)
    if (wsId) params.set('ws', wsId)
    params.set('view', 'buckets')
    if (bucket) params.set('bucket', bucket)
    return `/s3?${params.toString()}`
  }
}
