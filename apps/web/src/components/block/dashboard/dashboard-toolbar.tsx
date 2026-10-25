import { IconCalendar, IconFilter, IconUpload } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'
import { format } from 'date-fns'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useWorkspaceContext } from '@/hooks/use-workspace-context'
import { cn } from '@/lib/utils'

export type OverviewFilter =
  | 'all'
  | 'Document'
  | 'Spreadsheet'
  | 'Presentation'
  | 'Image'
  | 'Archive'

const FILTER_OPTIONS: Array<{ value: OverviewFilter; label: string }> = [
  { value: 'all', label: 'All files' },
  { value: 'Document', label: 'Documents' },
  { value: 'Spreadsheet', label: 'Spreadsheets' },
  { value: 'Presentation', label: 'Presentations' },
  { value: 'Image', label: 'Images' },
  { value: 'Archive', label: 'Archives' },
]

type DashboardToolbarProps = {
  filter: OverviewFilter
  onFilterChange: (filter: OverviewFilter) => void
}

/**
 * The toolbar between the welcome header and the content cards: the month
 * scope label on the left, the type filter next to it, and the primary upload
 * action on the right. The filter state lives in the dashboard content and
 * drives the Overview Storage table. The month is a static label until a real
 * date-range query exists — a calendar popover that filters nothing would be
 * a control that lies.
 */
export default function DashboardToolbar({ filter, onFilterChange }: DashboardToolbarProps) {
  const { orgId, wsId } = useWorkspaceContext()

  const activeFilter = FILTER_OPTIONS.find((option) => option.value === filter)

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <IconCalendar className="size-4" aria-hidden="true" />
        {format(new Date(), 'MMMM yyyy')}
      </p>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="font-medium">
            <IconFilter className="size-4 text-muted-foreground" />
            {filter === 'all' ? 'Filter' : activeFilter?.label}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-44">
          <DropdownMenuLabel className="text-xs text-muted-foreground">File type</DropdownMenuLabel>
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

      <Button variant="mono" size="lg" asChild className="ml-auto">
        <Link to="/settings" search={{ tab: 's3', org: orgId || undefined, ws: wsId || undefined }}>
          <IconUpload className="size-4" />
          Upload File
        </Link>
      </Button>
    </div>
  )
}
