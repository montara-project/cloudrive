import {
  IconDotsVertical,
  IconFilter,
  IconLayoutGrid,
  IconList,
  IconPlus,
} from '@tabler/icons-react'
import { useState } from 'react'

import type { MockOverviewFile } from '@/data/mock/dashboard'

import FileIcon from '@/components/block/dashboard/file-icon'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

type OverviewTableProps = {
  files: MockOverviewFile[]
  filter: string
  onFilterChange: (filter: 'all' | MockOverviewType) => void
}

type MockOverviewType = 'Document' | 'Spreadsheet' | 'Presentation' | 'Image' | 'Archive'

const FILTER_OPTIONS: Array<{ value: 'all' | MockOverviewType; label: string }> = [
  { value: 'all', label: 'All files' },
  { value: 'Document', label: 'Documents' },
  { value: 'Spreadsheet', label: 'Spreadsheets' },
  { value: 'Presentation', label: 'Presentations' },
  { value: 'Image', label: 'Images' },
  { value: 'Archive', label: 'Archives' },
]

/**
 * Overview Storage — the workspace's file inventory as a sortable-width table
 * or card grid, with the shared type filter applied. Rows are mock fixtures;
 * the column set matches the real drive listing so the swap is mechanical.
 */
export default function OverviewTable({ files, filter, onFilterChange }: OverviewTableProps) {
  const [view, setView] = useState<'list' | 'grid'>('list')
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())

  const allSelected = files.length > 0 && files.every((file) => selected.has(file.id))

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(files.map((file) => file.id)))
  }

  const toggleOne = (id: string) => {
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const activeFilter = FILTER_OPTIONS.find((option) => option.value === filter)

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-4">
        <h2 className="text-base font-semibold tracking-tight">Overview Storage</h2>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm">
            <IconPlus className="size-4" />
            Create
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <IconFilter className="size-3.5 text-muted-foreground" />
                {filter === 'all' ? 'Filter' : activeFilter?.label}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                File type
              </DropdownMenuLabel>
              {FILTER_OPTIONS.map((option, index) => (
                <div key={option.value}>
                  {index === 1 && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    onClick={() => onFilterChange(option.value)}
                    className={cn(filter === option.value && 'bg-accent')}
                  >
                    {option.label}
                  </DropdownMenuItem>
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="mx-0.5 h-6 w-px bg-border" aria-hidden="true" />
          <div className="flex items-center rounded-lg border p-0.5">
            <button
              type="button"
              aria-label="List view"
              aria-pressed={view === 'list'}
              onClick={() => setView('list')}
              className={cn(
                'flex size-7 cursor-pointer items-center justify-center rounded-md transition-colors',
                view === 'list'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <IconList className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Grid view"
              aria-pressed={view === 'grid'}
              onClick={() => setView('grid')}
              className={cn(
                'flex size-7 cursor-pointer items-center justify-center rounded-md transition-colors',
                view === 'grid'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <IconLayoutGrid className="size-4" />
            </button>
          </div>
          <button
            type="button"
            aria-label="Overview options"
            className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <IconDotsVertical className="size-4" />
          </button>
        </div>
      </div>

      {files.length === 0 ? (
        <p className="border-t px-5 py-10 text-center text-sm text-muted-foreground">
          No files match this filter.
        </p>
      ) : view === 'list' ? (
        <div className="overflow-x-auto border-t">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                <th className="w-11 py-3 pl-5">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select all files"
                  />
                </th>
                <th className="py-3 pr-4 font-medium">File Name</th>
                <th className="hidden py-3 pr-4 font-medium lg:table-cell">Date Uploaded</th>
                <th className="hidden py-3 pr-4 font-medium md:table-cell">Last Updated</th>
                <th className="py-3 pr-4 font-medium">Size</th>
                <th className="hidden py-3 pr-4 font-medium md:table-cell">Type</th>
                <th className="py-3 pr-4 font-medium">Owner</th>
                <th className="w-12 py-3 pr-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr
                  key={file.id}
                  className="border-b transition-colors last:border-0 hover:bg-muted/40"
                >
                  <td className="py-3 pl-5">
                    <Checkbox
                      checked={selected.has(file.id)}
                      onCheckedChange={() => toggleOne(file.id)}
                      aria-label={`Select ${file.name}`}
                    />
                  </td>
                  <td className="py-3 pr-4">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <FileIcon fileName={file.name} className="size-8" />
                      <span className="truncate font-medium">{file.name}</span>
                    </span>
                  </td>
                  <td className="hidden py-3 pr-4 whitespace-nowrap text-muted-foreground lg:table-cell">
                    {file.dateUploaded}
                  </td>
                  <td className="hidden py-3 pr-4 whitespace-nowrap text-muted-foreground md:table-cell">
                    {file.lastUpdated}
                  </td>
                  <td className="py-3 pr-4 tabular-nums">{file.sizeLabel}</td>
                  <td className="hidden py-3 pr-4 text-muted-foreground md:table-cell">
                    {file.typeLabel}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className="flex items-center gap-2 whitespace-nowrap"
                      aria-label={`Owner ${file.owner.name}`}
                    >
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-semibold text-violet-700">
                        {file.owner.initials}
                      </span>
                      <span className="hidden text-muted-foreground md:inline">
                        {file.owner.name}
                      </span>
                    </span>
                  </td>
                  <td className="py-3 pr-3 text-right">
                    <button
                      type="button"
                      aria-label={`Actions for ${file.name}`}
                      className="flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <IconDotsVertical className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 border-t px-5 py-4 sm:grid-cols-2 xl:grid-cols-3">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 rounded-xl border bg-background py-3 pr-2 pl-3.5 transition-colors hover:border-primary/40"
            >
              <FileIcon fileName={file.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {file.sizeLabel} · {file.typeLabel}
                </p>
              </div>
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-semibold text-violet-700">
                {file.owner.initials}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
