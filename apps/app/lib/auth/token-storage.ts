import { AUTH_STORAGE_KEYS } from '../constants/auth'
import { getQueryClient } from '../providers/react-query'

const isBrowser = typeof window !== 'undefined'

// Access/id tokens are short lived; refresh token needs to outlive them.
const DEFAULT_ACCESS_TOKEN_MAX_AGE = 60 * 60 // 1 hour
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export interface AuthTokens {
  accessToken: string
  refreshToken?: string
  idToken?: string
  /** Access token lifetime in seconds, as returned by the backend (`expires_in`). */
  expiresIn?: number
}

function writeCookie(name: string, value: string, maxAgeSeconds: number) {
  if (!isBrowser) return

  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`
}

function readCookie(name: string): string | null {
  if (!isBrowser) return null

  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function removeCookie(name: string) {
  if (!isBrowser) return

  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`
}

/**
 * Persist backend-issued auth tokens in cookies so they are available both to the
 * browser (axios interceptor) and to the server (`getSession` in `handler.ts`).
 *
 * Writing tokens changes who the user is, so the cached session must go with
 * them: `getQueryClient().clear()` drops the stale "signed out" answer that
 * gates would otherwise reuse (the session query has no `staleTime` for exactly
 * this reason). `clear()` rather than `invalidateQueries` because every cached
 * query belongs to the previous identity — organizations, workspaces, storage
 * accounts — and must not survive a login or logout.
 */
export function setAuthTokens({ accessToken, refreshToken, idToken, expiresIn }: AuthTokens) {
  const accessMaxAge = expiresIn ?? DEFAULT_ACCESS_TOKEN_MAX_AGE

  // Access Token
  writeCookie(AUTH_STORAGE_KEYS.ACCESS_TOKEN, accessToken, accessMaxAge)

  // Refresh Token
  if (refreshToken) {
    writeCookie(AUTH_STORAGE_KEYS.REFRESH_TOKEN, refreshToken, REFRESH_TOKEN_MAX_AGE)
  }

  // ID Token
  if (idToken) {
    writeCookie(AUTH_STORAGE_KEYS.ID_TOKEN, idToken, accessMaxAge)
  }

  getQueryClient().clear()
}

/**
 * Read the backend-issued access token from cookies (client-side).
 */
export function getStoredAccessToken(): string | null {
  return readCookie(AUTH_STORAGE_KEYS.ACCESS_TOKEN)
}

/**
 * Read the backend-issued refresh token from cookies (client-side).
 */
export function getStoredRefreshToken(): string | null {
  return readCookie(AUTH_STORAGE_KEYS.REFRESH_TOKEN)
}

/**
 * Remove all backend-issued auth tokens from cookies.
 *
 * Drops the cached session with them, mirroring `setAuthTokens` — otherwise a
 * signed-out user would keep reading the previous identity until the query
 * happened to refetch.
 */
export function clearAuthTokens() {
  removeCookie(AUTH_STORAGE_KEYS.ACCESS_TOKEN)
  removeCookie(AUTH_STORAGE_KEYS.REFRESH_TOKEN)
  removeCookie(AUTH_STORAGE_KEYS.ID_TOKEN)

  getQueryClient().clear()
}
