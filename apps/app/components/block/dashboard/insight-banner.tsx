'use client'

import { IconSparkles, IconX } from '@tabler/icons-react'
import { useState } from 'react'

import { MOCK_INSIGHT } from '@/data/mock/dashboard'

/**
 * Dismissible storage-insight strip under the toolbar. The copy is a fixture
 * until usage analytics are wired; the dismiss state is intentionally
 * session-local.
 */
export default function InsightBanner() {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div className="flex items-center gap-3 rounded-xl border border-primary/15 bg-primary/[0.04] py-3 pr-2 pl-4">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-violet-500 text-white shadow-xs">
        <IconSparkles className="size-4.5" />
      </span>
      <p className="line-clamp-2 min-w-0 flex-1 text-sm text-foreground/90">{MOCK_INSIGHT}</p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss insight"
        className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <IconX className="size-4" />
      </button>
    </div>
  )
}
