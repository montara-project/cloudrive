'use client'

import { IconFolderOpen, IconStar } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { useWorkspaceContext } from '@/hooks/use-workspace-context'
import { queries } from '@/lib/api/queries'

import DriveFileList, { useDriveFileHref, type DriveFileRow } from './drive-file-list'
import { starredId, useStarred } from './starred-store'

/**
 * StarredContent filters the workspace's live listing down to the objects the
 * user bookmarked. Bookmarks are local (see starred-store), so a starred object
 * that no longer appears in the listing — deleted, or the account was
 * disconnected — is simply not shown rather than rendered as a dead row.
 */
export default function StarredContent() {
  const { wsId } = useWorkspaceContext()
  const hrefFor = useDriveFileHref()
  const { ids } = useStarred(wsId)

  const filesQuery = useQuery(queries.s3.buckets.recentFiles(wsId, { limit: 200 }))

  const starred = useMemo(() => new Set(ids), [ids])

  const files = useMemo<DriveFileRow[]>(
    () =>
      (filesQuery.data?.data ?? [])
        .filter((file) => starred.has(starredId(file.bucket, file.key)))
        .map((file) => ({
          id: starredId(file.bucket, file.key),
          name: file.key,
          size: file.size,
          content_type: file.content_type,
          last_modified: file.last_modified,
          source_name: file.bucket,
          provider_slug: file.provider_slug,
        })),
    [filesQuery.data, starred]
  )

  if (!wsId) {
    return (
      <Empty className="rounded-2xl border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconStar />
          </EmptyMedia>
          <EmptyTitle>No workspace selected</EmptyTitle>
          <EmptyDescription>
            Pick a workspace in the sidebar to see its starred files.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
          <IconStar className="size-5.5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Starred</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Files you starred in this workspace, kept on this device.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border bg-card">
        <DriveFileList
          files={files}
          isLoading={filesQuery.isLoading}
          sourceLabel="Bucket"
          emptyMessage="Nothing starred yet. Starring a file in this workspace keeps it here for quick access."
          hrefFor={(file) => hrefFor(file.source_name)}
        />
      </div>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <IconFolderOpen className="size-3.5" />
        Stars are stored in this browser per workspace.
      </p>
    </div>
  )
}
