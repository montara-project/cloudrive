import { IconCalendar, IconChevronDown, IconFilter, IconUpload } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'
import { format } from 'date-fns'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useWorkspaceContext } from '@/hooks/use-workspace-context'
import { cn, hrefToLocation } from '@/lib/utils'

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
 * The toolbar between the welcome header and the content cards: date scope on
 * the left, the type filter in the middle, and the primary upload action on
 * the right. The filter state lives in the dashboard content and drives the
 * Overview Storage table.
 */
export default function DashboardToolbar({ filter, onFilterChange }: DashboardToolbarProps) {
  const { orgId, wsId } = useWorkspaceContext()
  const [month, setMonth] = useState<Date>(new Date())
  const monthLabel = useMemo(() => format(month, 'MMMM yyyy'), [month])

  const scopedHref = (url: string) => {
    const params = new URLSearchParams()
    if (orgId) params.set('org', orgId)
    if (wsId) params.set('ws', wsId)
    const query = params.toString()
    return query ? `${url}?${query}` : url
  }

  const activeFilter = FILTER_OPTIONS.find((option) => option.value === filter)

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="font-medium">
            <IconCalendar className="size-4 text-muted-foreground" />
            {monthLabel}
            <IconChevronDown className="size-3.5 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar mode="single" month={month} onMonthChange={setMonth} selected={month} />
        </PopoverContent>
      </Popover>

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
        <Link {...hrefToLocation(scopedHref('/s3'))}>
          <IconUpload className="size-4" />
          Upload File
        </Link>
      </Button>
    </div>
  )
}
