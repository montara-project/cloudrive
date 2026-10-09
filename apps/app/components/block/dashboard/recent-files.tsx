'use client'

import { IconArrowRight } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useWorkspaceContext } from '@/hooks/use-workspace-context'
import { queries } from '@/lib/api/queries'
import { formatBytes } from '@/lib/format'

import FileIcon from './file-icon'

/**
 * RecentFilesSection lists the most recently modified objects across the
 * workspace's gateway buckets. Hidden entirely when no workspace is active —
 * the stat cards above already funnel workspace setup.
 */
export default function RecentFilesSection() {
  const { wsId, orgId } = useWorkspaceContext()
  const filesQuery = useQuery(queries.s3.buckets.recentFiles(wsId, { limit: 8 }))

  if (!wsId) return null

  const files = filesQuery.data?.data ?? []

  const params = new URLSearchParams()
  if (orgId) params.set('org', orgId)
  params.set('ws', wsId)

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Recent files</CardTitle>
        <Link
          href={`/s3?${params.toString()}`}
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          View all <IconArrowRight className="size-3.5" />
        </Link>
      </CardHeader>
      <CardContent>
        {filesQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton className="size-9 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-52" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        ) : files.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No files yet. Objects uploaded through the workspace&apos;s S3 gateway buckets show up
            here.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {files.map((file) => (
              <li key={`${file.bucket}/${file.key}`} className="flex items-center gap-3 py-2.5">
                <FileIcon fileName={file.key} contentType={file.content_type} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.key}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {file.bucket}
                    {file.provider_slug &&
                      ` · ${file.provider_slug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-medium tabular-nums">{formatBytes(file.size)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(file.last_modified), { addSuffix: true })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
