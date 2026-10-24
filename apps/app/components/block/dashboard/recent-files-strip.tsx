'use client'

import { IconDotsVertical } from '@tabler/icons-react'

import FileIcon from '@/components/block/dashboard/file-icon'
import { MOCK_RECENT_FILES } from '@/data/mock/dashboard'

/**
 * Recent Files strip — horizontally scrollable file chips, one per recently
 * touched object, with the shared file-type glyph. Entries come from the mock
 * fixtures; the shape matches a `queries.s3.buckets.recentFiles` response.
 */
export default function RecentFilesStrip() {
  return (
    <section className="min-w-0 rounded-xl border bg-card shadow-xs">
      <div className="flex items-center justify-between px-5 pt-4">
        <h2 className="text-base font-semibold tracking-tight">Recent Files</h2>
        <button
          type="button"
          aria-label="Recent files options"
          className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <IconDotsVertical className="size-4" />
        </button>
      </div>

      <div className="no-scrollbar flex gap-3 overflow-x-auto px-5 pt-3.5 pb-5">
        {MOCK_RECENT_FILES.map((file) => (
          <div
            key={file.id}
            className="flex min-w-[232px] shrink-0 items-center gap-3 rounded-xl border bg-background py-2.5 pr-2 pl-3 transition-colors hover:border-primary/40"
          >
            <FileIcon fileName={file.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {file.sizeLabel} · {file.typeLabel}
              </p>
            </div>
            <button
              type="button"
              aria-label={`Actions for ${file.name}`}
              className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <IconDotsVertical className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
