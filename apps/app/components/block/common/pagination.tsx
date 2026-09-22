'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useQueryState } from 'nuqs'

import { Button } from '@/components/ui/button'

interface PaginationProps {
  total?: number
  limit?: number
}

/**
 * Server-driven pagination synced to the `page` query param (1-based, matching
 * the API's ListQuery). Hidden when everything fits on one page.
 */
export default function Pagination({ total = 0, limit = 20 }: PaginationProps) {
  const [pageParam, setPage] = useQueryState('page')
  const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1)
  const pages = Math.max(1, Math.ceil(total / limit))

  if (pages <= 1) return null

  return (
    <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
      <span>
        Page {page} of {pages} · {total} total
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => setPage(String(page - 1))}
        >
          <ChevronLeft className="size-4" />
          Prev
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pages}
          onClick={() => setPage(String(page + 1))}
        >
          Next
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
