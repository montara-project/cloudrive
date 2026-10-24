import { IconClock, IconFolderOpen } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import PageHeader from '@/components/layout/page-header'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { useWorkspaceContext } from '@/hooks/use-workspace-context'
import { queries } from '@/lib/api/queries'

import DriveFileList, { useDriveFileHref, type DriveFileRow } from './drive-file-list'

/**
 * RecentContent lists the workspace's most recently modified gateway objects,
 * newest first. It reads the same aggregation the dashboard's "Recent files"
 * card does, at a larger page size — no dedicated recent index exists server
 * side, so this is the drive's recent view by another door.
 */
export default function RecentContent() {
  const { wsId } = useWorkspaceContext()
  const hrefFor = useDriveFileHref()

  const filesQuery = useQuery(queries.s3.buckets.recentFiles(wsId, { limit: 100 }))

  const files = useMemo<DriveFileRow[]>(
    () =>
      (filesQuery.data?.data ?? []).map((file) => ({
        id: `${file.bucket}/${file.key}`,
        name: file.key,
        size: file.size,
        content_type: file.content_type,
        last_modified: file.last_modified,
        source_name: file.bucket,
        provider_slug: file.provider_slug,
      })),
    [filesQuery.data]
  )

  const header = (
    <PageHeader
      title="Recent"
      description="The latest files modified across this workspace."
      leading={
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <IconClock className="size-5.5" />
        </div>
      }
    />
  )

  if (!wsId) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <Empty className="rounded-2xl border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <IconClock />
            </EmptyMedia>
            <EmptyTitle>No workspace selected</EmptyTitle>
            <EmptyDescription>
              Pick a workspace in the sidebar to see its recent files.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {header}

      <div className="rounded-2xl border bg-card">
        <DriveFileList
          files={files}
          isLoading={filesQuery.isLoading}
          sourceLabel="Bucket"
          emptyMessage="No files yet. Objects uploaded through the workspace's gateway buckets show up here."
          hrefFor={(file) => hrefFor(file.source_name)}
        />
      </div>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <IconFolderOpen className="size-3.5" />
        Open a file&apos;s bucket to browse it in the S3 gateway.
      </p>
    </div>
  )
}
