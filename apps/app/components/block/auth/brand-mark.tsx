'use client'

import { cn } from '@/lib/utils'

/**
 * The Cloudrive mark — blue tile, cloud, amber drive light.
 *
 * Mirrors `app/icon.svg` so the favicon, the sign-in card and the loading
 * layer cannot drift apart.
 */
export default function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label="Cloudrive"
      className={cn('shrink-0', className)}
    >
      <rect width="32" height="32" rx="7" fill="#2563EB" />
      <path
        d="M10.5 22.5a4.6 4.6 0 0 1-.5-9.17A6.3 6.3 0 0 1 22.4 14.4a4.1 4.1 0 0 1-.9 8.1z"
        fill="#fff"
      />
      <circle cx="16" cy="18.4" r="2.1" fill="#D97706" />
    </svg>
  )
}
