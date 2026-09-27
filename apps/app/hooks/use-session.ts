'use client'

import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import type { AuthSession } from '@/types/auth'

import { signOut } from '@/lib/auth/email-auth'
import { getOptimisticSession, getSession } from '@/lib/auth/handler'
import { clearAuthTokens } from '@/lib/auth/token-storage'
import { SESSION_POLL_INTERVAL_MS } from '@/lib/constants/auth'

export const SESSION_QUERY_KEY = ['session'] as const

/**
 * The single session source for the whole app.
 *
 * Every gate (dashboard layout, login page, auth callback) and every consumer
 * (sidebar, settings) reads this one query, so an auth check is shared instead
 * of repeated per component. `retry: false` matters: a failed probe means "not
 * signed in", not "flaky network" — retrying only delays the redirect.
 *
 * Deliberately **no `staleTime`**: a token can expire at any moment, and a
 * cached "signed in" answer would keep the dashboard mounted against a dead
 * token. With `staleTime: 0` the query revalidates on every mount and on every
 * window refocus, so expiry surfaces as a redirect instead of a page of failed
 * requests. The extra probe is cheap (`GET /v1/me`) and the cache still dedupes
 * concurrent readers within a single render.
 *
 * While signed in the query also re-probes every `SESSION_POLL_INTERVAL_MS`.
 * Each run goes through `getSession` → `getValidAccessToken`, so the access
 * token is rotated via the refresh token before it can ever expire — periodic
 * server-side validation and proactive refresh in one probe.
 *
 * `placeholderData` answers from the locally stored credential snapshot, so
 * returning users paint instantly instead of waiting on `/v1/me` — the real
 * probe still runs in the background and overrides it.
 */
export const sessionQuery = () =>
  queryOptions({
    queryKey: SESSION_QUERY_KEY,
    queryFn: getSession,
    retry: false,
    staleTime: 0,
    refetchInterval: (query) => (query.state.data ? SESSION_POLL_INTERVAL_MS : false),
    placeholderData: getOptimisticSession,
  })

/**
 * Read the current session.
 *
 * `isPending` is the "we don't know yet" state — callers must render a loading
 * layer while it is true, and only trust `data === null` once it is false.
 */
export function useSession() {
  return useQuery(sessionQuery())
}

/**
 * Sign out and return to /.
 *
 * The cached session is dropped before navigating so no gate can briefly
 * re-render as authenticated on the way out.
 */
export function useSignOut() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      await signOut()
    } finally {
      clearAuthTokens()
      queryClient.clear()
      toast.success('Signed out')
      router.replace('/')
      setIsSigningOut(false)
    }
  }

  return { signOut: handleSignOut, isSigningOut }
}

export type { AuthSession }
