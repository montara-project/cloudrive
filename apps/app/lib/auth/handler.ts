import type { AuthSession } from '@/types/auth'

import type { Models } from '../api/models'

import { authClient } from './client'
import { REFRESH_SKEW_MS, getValidAccessToken } from './refresh'
import {
  clearAuthTokens,
  getRefreshTokenExpiresAt,
  getStoredAccessToken,
  getStoredRefreshToken,
  getStoredUser,
  setStoredUser,
} from './token-storage'

/**
 * Read the session issued by our own backend.
 *
 * Identity is resolved via `GET /v1/me` on the better-auth client. The bearer
 * token goes through `getValidAccessToken` first, so an expiring access token
 * is rotated through the refresh token before the probe is sent — the server
 * authenticates by bearer token only, there is no session-cookie fallback.
 *
 * The user snapshot is persisted on every successful probe so
 * `getOptimisticSession` can answer "signed in" instantly on the next visit.
 */
async function getBackendSession(): Promise<AuthSession | null> {
  const accessToken = await getValidAccessToken()

  if (!accessToken) {
    return null
  }

  try {
    const { data: user, error } = await authClient.me()

    if (error || !user) {
      // A definitive 401 means the credential is dead — drop it so the
      // optimistic snapshot stops vouching for a revoked session.
      if (error?.status === 401) {
        clearAuthTokens()
      }
      return null
    }

    setStoredUser(user)

    return {
      user,
      session: { token: accessToken },
      data: {
        accessToken,
        refreshToken: getStoredRefreshToken() ?? undefined,
        provider: 'custom',
      },
    }
  } catch (error) {
    console.error('Backend session error:', (error as Error).message)
    return null
  }
}

/**
 * Synchronously resolve the session from locally stored credentials.
 *
 * Used as the session query's `placeholderData` so gates can mount instantly
 * instead of waiting on `/v1/me`. It answers "probably signed in" — enough to
 * paint the dashboard — while the real probe revalidates in the background and
 * bounces to / if the server disagrees. A dead or missing credential set
 * returns null so first-time visitors and signed-out users probe normally.
 */
export function getOptimisticSession(): AuthSession | null {
  const user = getStoredUser<Models.User>()
  const accessToken = getStoredAccessToken()
  const refreshToken = getStoredRefreshToken()
  const refreshExpiresAt = getRefreshTokenExpiresAt()

  if (!user) return null

  // The access cookie dies with its Max-Age, so its presence already implies
  // "fresh". When it's gone, an alive refresh token means the probe can
  // recover the session — still worth painting optimistically.
  const canRecover =
    refreshToken != null &&
    (refreshExpiresAt == null || Date.now() < refreshExpiresAt - REFRESH_SKEW_MS)

  if (!accessToken && !canRecover) return null

  return {
    user,
    session: { token: accessToken ?? '' },
    data: {
      accessToken: accessToken ?? undefined,
      refreshToken: refreshToken ?? undefined,
      provider: 'custom',
    },
  }
}

/**
 * Get current session.
 * @returns Session object or null if not authenticated.
 */
export async function getSession(): Promise<AuthSession | null> {
  return getBackendSession()
}
