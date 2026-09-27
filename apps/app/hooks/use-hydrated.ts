import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

/**
 * True only after hydration completes.
 *
 * Gates rendering that depends on client-only state (cookies, localStorage)
 * which can never match the server's HTML: render a stable fallback until this
 * flips, then swap — React re-checks the snapshot right after hydration, so
 * the swap lands in the first post-hydration frame, not on a network wait.
 */
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )
}
