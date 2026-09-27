'use client'

import {
  IconArrowDown,
  IconArrowUp,
  IconFolder,
  IconLayoutGrid,
  IconList,
  IconSearch,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { format, isAfter, subDays, subHours } from 'date-fns'
import { useQueryState } from 'nuqs'
import { useMemo, useState } from 'react'

import type { DriveEntry } from '@/lib/api/services/types/s3'

import ProviderIcon from '@/components/block/common/provider-icon'
import FileIcon, { fileCategory, type FileCategory } from '@/components/block/dashboard/file-icon'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useWorkspaceContext } from '@/hooks/use-workspace-context'
import { queries } from '@/lib/api/queries'
import { formatBytes } from '@/lib/format'
import { cn } from '@/lib/utils'

type TypeFilter = 'all' | 'folders' | FileCategory
type TimeFilter = 'all' | 'today' | '7d' | '30d'

const TYPE_FILTER_LABELS: Record<TypeFilter, string> = {
  all: 'All types',
  folders: 'Folders',
  pdf: 'PDF',
  document: 'Documents',
  spreadsheet: 'Spreadsheets',
  archive: 'Archives',
  image: 'Images',
  video: 'Videos',
  audio: 'Audio',
  code: 'Code',
  other: 'Other',
}

const TIME_FILTER_LABELS: Record<TimeFilter, string> = {
  all: 'All time',
  today: 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
}

function timeCutoff(filter: TimeFilter): Date | null {
  const now = new Date()
  if (filter === 'today') return subHours(now, 24)
  if (filter === '7d') return subDays(now, 7)
  if (filter === '30d') return subDays(now, 30)
  return null
}

/**
 * DriveContent is the My Drive browser: one level of every provider account's
 * drive merged per prefix, with type/owner/time filters, name search, and a
 * list/grid toggle. Folder rows navigate deeper via the shareable `prefix`
 * query param.
 */
export default function DriveContent() {
  const { wsId } = useWorkspaceContext()
  const [prefix, setPrefix] = useQueryState('prefix')
  const [view, setView] = useState<'list' | 'grid'>('list')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [accountFilter, setAccountFilter] = useState<string>('all')
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all')
  const [search, setSearch] = useState('')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')

  const entriesQuery = useQuery(queries.drive.list(wsId, prefix ?? undefined))
  // Memoized on the query data so the array identity is stable across renders.
  const entries = useMemo(
    () => (entriesQuery.data?.data ?? []) as DriveEntry[],
    [entriesQuery.data]
  )

  const accounts = useMemo(() => {
    const map = new Map<string, string>()
    entries.forEach((entry) => map.set(entry.account_id, entry.account_name))
    return [...map.entries()]
  }, [entries])

  const filtered = useMemo(() => {
    const cutoff = timeCutoff(timeFilter)
    const term = search.trim().toLowerCase()

    const matching = entries.filter((entry) => {
      if (accountFilter !== 'all' && entry.account_id !== accountFilter) return false
      if (cutoff && entry.type === 'file' && !isAfter(new Date(entry.last_modified), cutoff)) {
        return false
      }
      if (typeFilter === 'folders') {
        if (entry.type !== 'folder') return false
      } else if (
        typeFilter !== 'all' &&
        (entry.type === 'folder' || fileCategory(entry.name, entry.content_type) !== typeFilter)
      ) {
        return false
      }
      if (term && !entry.name.toLowerCase().includes(term)) return false
      return true
    })

    // Folders stay alphabetical first; files follow by the chosen order.
    const folders = matching
      .filter((entry) => entry.type === 'folder')
      .sort((a, b) => a.name.localeCompare(b.name))
    const files = matching
      .filter((entry) => entry.type === 'file')
      .sort((a, b) =>
        sortDir === 'desc'
          ? new Date(b.last_modified).getTime() - new Date(a.last_modified).getTime()
          : new Date(a.last_modified).getTime() - new Date(b.last_modified).getTime()
      )
    return [...folders, ...files]
  }, [entries, accountFilter, timeFilter, typeFilter, search, sortDir])

  const segments = useMemo(() => (prefix ?? '').split('/').filter(Boolean), [prefix])

  const openFolder = (name: string) => {
    setPrefix((prefix ?? '') + name + '/')
  }

  if (!wsId) {
    return (
      <Empty className="rounded-2xl border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconFolder />
          </EmptyMedia>
          <EmptyTitle>No workspace selected</EmptyTitle>
          <EmptyDescription>
            Pick a workspace in the sidebar to browse its provider drives.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Drive</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage the storage inside each connected provider account.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className={cn('rounded-full', view === 'list' && 'bg-primary/10 text-primary')}
            aria-label="List view"
            onClick={() => setView('list')}
          >
            <IconList className="size-4.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn('rounded-full', view === 'grid' && 'bg-primary/10 text-primary')}
            aria-label="Grid view"
            onClick={() => setView('grid')}
          >
            <IconLayoutGrid className="size-4.5" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as TypeFilter)}>
            <SelectTrigger className="h-9 w-fit rounded-full px-3.5 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TYPE_FILTER_LABELS) as TypeFilter[]).map((value) => (
                <SelectItem key={value} value={value}>
                  {TYPE_FILTER_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger className="h-9 w-fit rounded-full px-3.5 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {accounts.map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={timeFilter} onValueChange={(value) => setTimeFilter(value as TimeFilter)}>
            <SelectTrigger className="h-9 w-fit rounded-full px-3.5 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TIME_FILTER_LABELS) as TimeFilter[]).map((value) => (
                <SelectItem key={value} value={value}>
                  {TIME_FILTER_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="relative">
          <IconSearch className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search in current folder..."
            className="h-9 w-full rounded-full pl-9 sm:w-72"
          />
        </div>
      </div>

      {segments.length > 0 && (
        <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Folder path">
          <button
            type="button"
            onClick={() => setPrefix(null)}
            className={cn(
              'cursor-pointer rounded-md px-1.5 py-0.5 hover:bg-muted',
              segments.length === 0 ? 'font-medium' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            My Drive
          </button>
          {segments.map((segment, index) => {
            const isLast = index === segments.length - 1
            const target = segments.slice(0, index + 1).join('/') + '/'
            return (
              <span key={target} className="flex items-center gap-1">
                <span className="text-muted-foreground/50">/</span>
                <button
                  type="button"
                  onClick={() => setPrefix(target)}
                  className={cn(
                    'cursor-pointer rounded-md px-1.5 py-0.5 hover:bg-muted',
                    isLast ? 'font-medium' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {segment}
                </button>
              </span>
            )
          })}
        </nav>
      )}

      <div className="rounded-2xl border bg-card">
        {entriesQuery.isLoading ? (
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
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {search || typeFilter !== 'all' || accountFilter !== 'all' || timeFilter !== 'all'
              ? 'No entries match the current filters.'
              : prefix
                ? 'This folder is empty.'
                : 'No files yet. Files and folders inside your connected provider accounts appear here.'}
          </p>
        ) : view === 'list' ? (
          <div role="table" className="text-sm">
            <div className="flex items-center gap-3 border-b bg-muted/40 px-5 py-2.5 text-xs font-medium text-muted-foreground">
              <span className="flex-1">Name</span>
              <span className="hidden w-56 md:block">Owner</span>
              <button
                type="button"
                className="inline-flex w-36 cursor-pointer items-center gap-1 hover:text-foreground"
                onClick={() => setSortDir((dir) => (dir === 'desc' ? 'asc' : 'desc'))}
              >
                Last modified
                {sortDir === 'desc' ? (
                  <IconArrowDown className="size-3.5" />
                ) : (
                  <IconArrowUp className="size-3.5" />
                )}
              </button>
              <span className="w-20 text-right">Size</span>
            </div>

            {filtered.map((entry) => (
              <div
                key={`${entry.account_id}/${entry.name}`}
                className={cn(
                  'flex items-center gap-3 border-b border-border/60 px-5 py-3 last:border-b-0',
                  entry.type === 'folder' && 'cursor-pointer hover:bg-muted/40'
                )}
                onClick={entry.type === 'folder' ? () => openFolder(entry.name) : undefined}
                role={entry.type === 'folder' ? 'button' : undefined}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {entry.type === 'folder' ? (
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <IconFolder className="size-4.5 text-muted-foreground" />
                    </div>
                  ) : (
                    <FileIcon fileName={entry.name} contentType={entry.content_type} />
                  )}
                  <span className="truncate font-medium">{entry.name}</span>
                </div>

                <div className="hidden w-56 items-center gap-2 md:flex">
                  <ProviderIcon slug={entry.provider_slug} className="size-6 rounded-md" />
                  <span className="truncate text-muted-foreground">{entry.account_name}</span>
                </div>

                <span className="w-36 truncate text-muted-foreground">
                  {entry.type === 'folder'
                    ? '—'
                    : format(new Date(entry.last_modified), 'd MMM yyyy')}
                </span>

                <span className="w-20 text-right text-muted-foreground tabular-nums">
                  {entry.type === 'folder' ? '—' : formatBytes(entry.size)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((entry) => (
              <div
                key={`${entry.account_id}/${entry.name}`}
                className={cn(
                  'rounded-xl border p-3 transition-colors',
                  entry.type === 'folder' &&
                    'cursor-pointer hover:border-primary/40 hover:bg-muted/40'
                )}
                onClick={entry.type === 'folder' ? () => openFolder(entry.name) : undefined}
                role={entry.type === 'folder' ? 'button' : undefined}
              >
                {entry.type === 'folder' ? (
                  <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                    <IconFolder className="size-4.5 text-muted-foreground" />
                  </div>
                ) : (
                  <FileIcon fileName={entry.name} contentType={entry.content_type} />
                )}
                <p className="mt-2.5 truncate text-sm font-medium">{entry.name}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {entry.type === 'folder'
                    ? 'Folder'
                    : `${formatBytes(entry.size)} · ${format(new Date(entry.last_modified), 'd MMM yyyy')}`}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
