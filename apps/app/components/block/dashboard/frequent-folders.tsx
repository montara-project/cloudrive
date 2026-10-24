'use client'

import { IconDotsVertical, IconFolderFilled } from '@tabler/icons-react'
import Link from 'next/link'

import FolderArt from '@/components/block/dashboard/folder-art'
import { MOCK_FREQUENT_FOLDERS } from '@/data/mock/dashboard'
import { useWorkspaceContext } from '@/hooks/use-workspace-context'
import { cn } from '@/lib/utils'

type FrequentFoldersProps = {
  view: 'grid' | 'list'
}

/**
 * Frequently Access — the workspace's most recently opened folders, rendered
 * as illustrated cards (grid) or compact rows (list) per the browse view
 * toggle in the breadcrumb bar. Entries are mock fixtures.
 */
export default function FrequentFolders({ view }: FrequentFoldersProps) {
  const { orgId, wsId } = useWorkspaceContext()

  const folderHref = () => {
    const params = new URLSearchParams()
    if (orgId) params.set('org', orgId)
    if (wsId) params.set('ws', wsId)
    const query = params.toString()
    return query ? `/drive?${query}` : '/drive'
  }

  return (
    <section className="rounded-xl border bg-card shadow-xs">
      <div className="flex items-center justify-between px-5 pt-4">
        <h2 className="text-base font-semibold tracking-tight">Frequently Access</h2>
        <button
          type="button"
          aria-label="Frequently access options"
          className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <IconDotsVertical className="size-4" />
        </button>
      </div>

      {view === 'grid' ? (
        <div className="grid grid-cols-2 gap-3 px-5 pt-3.5 pb-5 sm:grid-cols-3 xl:grid-cols-6">
          {MOCK_FREQUENT_FOLDERS.map((folder) => (
            <Link
              key={folder.id}
              href={folderHref()}
              className="group rounded-xl border bg-background px-2.5 py-3 transition-all hover:border-primary/40 hover:shadow-sm"
            >
              <FolderArt className="mx-auto w-full max-w-26 transition-transform duration-300 ease-out group-hover:-translate-y-0.5" />
              <p className="mt-2 truncate text-[13px] font-semibold">{folder.name}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                Folder · {folder.openedLabel}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <ul className="px-5 pt-2 pb-4">
          {MOCK_FREQUENT_FOLDERS.map((folder) => (
            <li key={folder.id}>
              <Link
                href={folderHref()}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-accent'
                )}
              >
                <IconFolderFilled className="size-4.5 fill-amber-400 text-amber-500" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{folder.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{folder.openedLabel}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
