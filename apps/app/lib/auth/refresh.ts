import { authClient } from './client'
import {
  clearAuthTokens,
  getAccessTokenExpiresAt,
  getRefreshTokenExpiresAt,
  getStoredAccessToken,
  getStoredRefreshToken,
  rotateTokenPair,
} from './token-storage'

/**
 * Start a refresh this many milliseconds before the stored expiry so requests
 * never ride on a token that dies mid-flight.
 */
export const REFRESH_SKEW_MS = 30_000

// Single-flight: concurrent callers (the axios interceptor, the session
// probe, a burst of API calls after mount) share one refresh request instead
// of racing the refresh-token rotation.
let refreshInFlight: Promise<string | null> | null = null

/**
 * Resolve a usable access token, refreshing proactively.
 *
 * Returns the stored token while it is fresh; when it is missing or inside
 * the refresh skew it exchanges the refresh token for a new pair first.
 * Returns null only when there is no credential left to save — a dead refresh
 * token or a failed exchange — which callers should treat as "signed out".
 */
export async function getValidAccessToken(): Promise<string | null> {
  const token = getStoredAccessToken()
  const expiresAt = getAccessTokenExpiresAt()

  if (token && (!expiresAt || Date.now() < expiresAt - REFRESH_SKEW_MS)) {
    return token
  }

  return refreshTokens()
}

/**
 * Exchange the refresh token for a new pair, deduplicating concurrent calls.
 *
 * A failed exchange clears local tokens: the server has already revoked the
 * session (or the token is unrecoverable), so keeping it around would only
 * produce 401s until the cookie expired on its own.
 */
export function refreshTokens(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight

  const refreshToken = getStoredRefreshToken()
  const refreshExpiresAt = getRefreshTokenExpiresAt()

  // No refresh token: nothing to rotate with — hand back whatever access
  // token is stored (possibly none/expired) and let the caller's request
  // decide. This covers accounts created before refresh tokens existed.
  if (!refreshToken) {
    return Promise.resolve(getStoredAccessToken())
  }

  // Refresh token itself is dead: the session is unrecoverable.
  if (refreshExpiresAt && Date.now() >= refreshExpiresAt - REFRESH_SKEW_MS) {
    clearAuthTokens()
    return Promise.resolve(null)
  }

  refreshInFlight = (async () => {
    const { data, error } = await authClient.refreshTokenPair({ refresh_token: refreshToken })

    if (error || !data?.access_token) {
      clearAuthTokens()
      return null
    }

    rotateTokenPair(data)
    return data.access_token
  })().finally(() => {
    refreshInFlight = null
  })

  return refreshInFlight
}
