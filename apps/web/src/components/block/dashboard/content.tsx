import { IconChevronDown, IconLayoutGrid, IconList } from '@tabler/icons-react'
import { useMemo, useState } from 'react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MOCK_ORG, MOCK_OVERVIEW_FILES, MOCK_WORKSPACES } from '@/data/mock/dashboard'
import { useWorkspaceContext } from '@/hooks/use-workspace-context'
import { cn } from '@/lib/utils'

import DashboardToolbar, { type OverviewFilter } from './dashboard-toolbar'
import DataStorageCard from './data-storage-card'
import FrequentFolders from './frequent-folders'
import InsightBanner from './insight-banner'
import OverviewTable from './overview-table'
import RecentFilesStrip from './recent-files-strip'
import WelcomeHeader from './welcome-header'

type SortKey = 'recent' | 'name' | 'size'

const SIZE_UNITS: Record<string, number> = { KB: 1, MB: 2, GB: 3, TB: 4 }

/** Parse "8.25 MB" into comparable bytes — fixture sizes are display strings. */
const sizeToBytes = (label: string) => {
  const [value, unit] = label.split(' ')
  return Number.parseFloat(value) * 1024 ** (SIZE_UNITS[unit ?? ''] ?? 0)
}

/**
 * DashboardContent — the redesigned overview: welcome header, toolbar,
 * insight strip, storage breakdown, then the browse area (breadcrumb, recent
 * files, frequently accessed folders, inventory table). Content renders from
 * the design-preview fixtures in `data/mock/dashboard.ts`; each section notes
 * the query that replaces it.
 */
export default function DashboardContent() {
  const { organization, workspace } = useWorkspaceContext()
  const [filter, setFilter] = useState<OverviewFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('recent')
  const [folderView, setFolderView] = useState<'grid' | 'list'>('grid')

  const orgName = organization?.name ?? MOCK_ORG.name
  const wsName = workspace?.name ?? MOCK_WORKSPACES[0].name

  const files = useMemo(() => {
    const filtered =
      filter === 'all'
        ? [...MOCK_OVERVIEW_FILES]
        : MOCK_OVERVIEW_FILES.filter((file) => file.typeLabel === filter)

    if (sortKey === 'name') filtered.sort((a, b) => a.name.localeCompare(b.name))
    if (sortKey === 'size')
      filtered.sort((a, b) => sizeToBytes(b.sizeLabel) - sizeToBytes(a.sizeLabel))

    return filtered
  }, [filter, sortKey])

  const sortLabels: Record<SortKey, string> = {
    recent: 'Last updated',
    name: 'Name',
    size: 'Size',
  }

  return (
    <div className="flex min-w-0 flex-col gap-5 md:gap-6">
      <WelcomeHeader />
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        <DashboardToolbar filter={filter} onFilterChange={setFilter} />
      </div>
      <div className="animate-in fade-in slide-in-from-bottom-2 delay-75 duration-500">
        <InsightBanner />
      </div>
      <div className="animate-in fade-in slide-in-from-bottom-2 delay-100 duration-500">
        <DataStorageCard />
      </div>

      {/* Browse area: breadcrumb + view controls, then the three content cards */}
      <div className="animate-in fade-in slide-in-from-bottom-2 delay-150 duration-500">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[15px]">
            <span className="text-muted-foreground">{orgName}</span>
            <span className="text-muted-foreground/60" aria-hidden="true">
              /
            </span>
            <span className="text-muted-foreground">{wsName}</span>
            <span className="text-muted-foreground/60" aria-hidden="true">
              /
            </span>
            <span className="font-semibold">Home</span>
          </nav>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  Sort by
                  <IconChevronDown className="size-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-40">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Sort files by
                </DropdownMenuLabel>
                {(Object.keys(sortLabels) as SortKey[]).map((key) => (
                  <DropdownMenuItem
                    key={key}
                    onClick={() => setSortKey(key)}
                    className={cn(sortKey === key && 'bg-accent')}
                  >
                    {sortLabels[key]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <span className="h-6 w-px bg-border" aria-hidden="true" />

            <div className="flex items-center rounded-lg border p-0.5">
              <button
                type="button"
                aria-label="Folders as list"
                aria-pressed={folderView === 'list'}
                onClick={() => setFolderView('list')}
                className={cn(
                  'flex size-7 cursor-pointer items-center justify-center rounded-md transition-colors',
                  folderView === 'list'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <IconList className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Folders as grid"
                aria-pressed={folderView === 'grid'}
                onClick={() => setFolderView('grid')}
                className={cn(
                  'flex size-7 cursor-pointer items-center justify-center rounded-md transition-colors',
                  folderView === 'grid'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <IconLayoutGrid className="size-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5 md:gap-6">
          <RecentFilesStrip />
          <FrequentFolders view={folderView} />
          <OverviewTable files={files} filter={filter} onFilterChange={setFilter} />
        </div>
      </div>
    </div>
  )
}
