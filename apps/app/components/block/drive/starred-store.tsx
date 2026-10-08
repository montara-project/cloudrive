'use client'

import { IconStar, IconStarFilled } from '@tabler/icons-react'
import { useSyncExternalStore } from 'react'

import { cn } from '@/lib/utils'

// ── Starred files, stored per workspace ────────────────────────────────────
//
// The API has no favorites endpoint yet, so a star is a local bookmark: the
// object's `bucket/key` is kept in localStorage against the workspace that saw
// it. That keeps the view honest — it only ever lists objects it can still
// verify against a live listing — and it survives reloads without pretending
// to be shared across devices.

const storageKey = (wsId: string) => `cloudrive.starred.${wsId}`

/** Stable identity for a gateway object across listings. */
export function starredId(accountOrBucket: string, nameOrKey: string) {
  return `${accountOrBucket}/${nameOrKey}`
}

const EMPTY: string[] = []

// Parsed lists are cached per workspace so `getSnapshot` can return a stable
// reference — `useSyncExternalStore` re-renders on every identity change, and
// re-parsing on each read would loop forever.
const cache = new Map<string, string[]>()
const listeners = new Map<string, Set<() => void>>()

function read(wsId: string): string[] {
  try {
    const raw = window.localStorage.getItem(storageKey(wsId))
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    // A corrupted entry should cost the user their bookmarks, not the page.
    return EMPTY
  }
}

function getSnapshot(wsId: string): string[] {
  const cached = cache.get(wsId)
  if (cached) return cached

  const ids = typeof window === 'undefined' ? EMPTY : read(wsId)
  cache.set(wsId, ids)
  return ids
}

function subscribe(wsId: string, onChange: () => void) {
  const forWorkspace = listeners.get(wsId) ?? new Set<() => void>()
  forWorkspace.add(onChange)
  listeners.set(wsId, forWorkspace)

  // Another tab writing the same workspace's stars should be reflected here,
  // so the storage event is treated as an external change and re-read.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== storageKey(wsId)) return
    cache.delete(wsId)
    forWorkspace.forEach((listener) => listener())
  }
  window.addEventListener('storage', onStorage)

  return () => {
    forWorkspace.delete(onChange)
    if (forWorkspace.size === 0) listeners.delete(wsId)
    window.removeEventListener('storage', onStorage)
  }
}

/**
 * useStarred reads and writes this browser's bookmarks for one workspace.
 * Returns the ids plus a `toggle` that persists and notifies every reader.
 */
export function useStarred(wsId: string | undefined) {
  const id = wsId ?? ''
  const ids = useSyncExternalStore(
    (onChange) => subscribe(id, onChange),
    () => getSnapshot(id),
    () => EMPTY
  )

  const toggle = (entryId: string) => {
    if (!wsId) return
    const next = ids.includes(entryId)
      ? ids.filter((entry) => entry !== entryId)
      : [...ids, entryId]

    cache.set(id, next)
    try {
      window.localStorage.setItem(storageKey(id), JSON.stringify(next))
    } catch {
      // Quota or a locked-down browser: keep the in-memory view usable.
    }
    listeners.get(id)?.forEach((listener) => listener())
  }

  return { ids, toggle }
}

type StarToggleProps = {
  active: boolean
  onToggle: () => void
  label?: string
}

/**
 * StarToggle is the per-row star. It stops the click so the surrounding row
 * link still navigates the rest of the time, and it is a real button so the
 * keyboard can reach it.
 */
export default function StarToggle({ active, onToggle, label }: StarToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? `Unstar ${label ?? 'file'}` : `Star ${label ?? 'file'}`}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onToggle()
      }}
      className={cn(
        'flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors',
        active
          ? 'text-amber-500 hover:bg-amber-500/10'
          : 'text-muted-foreground/60 hover:bg-muted hover:text-foreground'
      )}
    >
      {active ? <IconStarFilled className="size-4" /> : <IconStar className="size-4" />}
    </button>
  )
}
