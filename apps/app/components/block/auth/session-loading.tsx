'use client'

import { cn } from '@/lib/utils'

import { CloudriveLogo } from '../common/brand'

type SessionLoadingProps = {
  /** What the app is doing right now, shown under the app name. */
  message?: string
  className?: string
}

/**
 * The one transition layer for every auth check.
 *
 * Rendered instead of — never on top of — the destination screen, so the user
 * sees a single full-screen state while the session is unknown: no sign-in form
 * that flashes away for an already-authenticated visitor, and no dashboard
 * chrome that gets replaced once the check resolves.
 */
export default function SessionLoading({
  message = 'Checking your session…',
  className,
}: SessionLoadingProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'bg-background animate-in fade-in-0 fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 duration-200',
        className
      )}
    >
      <div className="flex flex-col items-center gap-1 text-center">
        <CloudriveLogo size="lg" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>

      <span
        aria-hidden
        className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent motion-reduce:animate-none"
      />
    </div>
  )
}
