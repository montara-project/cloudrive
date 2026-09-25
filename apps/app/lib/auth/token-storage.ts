import type { TokenPairResponse } from '../api/dtos/auth/types'

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
  /** Access token expiry as epoch milliseconds (`expires_at` once the server sends it). */
  accessTokenExpiresAt?: number
  /** Refresh token expiry as epoch milliseconds. */
  refreshTokenExpiresAt?: number
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

function readEpochCookie(name: string): number | null {
  const value = readCookie(name)
  if (!value) return null

  const epoch = Number(value)
  return Number.isFinite(epoch) ? epoch : null
}

/**
 * Persist the last `/v1/me` user snapshot so the session query can paint an
 * optimistic session instantly instead of blocking on a network round-trip.
 */
export function setStoredUser(user: unknown) {
  writeCookie(AUTH_STORAGE_KEYS.USER, JSON.stringify(user), REFRESH_TOKEN_MAX_AGE)
}

/**
 * Read the cached user snapshot, or null when absent/corrupt.
 */
export function getStoredUser<T>(): T | null {
  const value = readCookie(AUTH_STORAGE_KEYS.USER)
  if (!value) return null

  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function writeTokens({
  accessToken,
  refreshToken,
  idToken,
  expiresIn,
  accessTokenExpiresAt,
  refreshTokenExpiresAt,
}: AuthTokens) {
  const accessExpiresAt =
    accessTokenExpiresAt ?? Date.now() + (expiresIn ?? DEFAULT_ACCESS_TOKEN_MAX_AGE) * 1000
  const accessMaxAge = Math.max(0, Math.floor((accessExpiresAt - Date.now()) / 1000))

  writeCookie(AUTH_STORAGE_KEYS.ACCESS_TOKEN, accessToken, accessMaxAge)
  // Expiry markers must outlive the access token — they are what lets the
  // refresh path know the access cookie died on schedule, not because the
  // session is gone.
  writeCookie(
    AUTH_STORAGE_KEYS.ACCESS_TOKEN_EXPIRES_AT,
    String(accessExpiresAt),
    REFRESH_TOKEN_MAX_AGE
  )

  if (refreshToken) {
    writeCookie(AUTH_STORAGE_KEYS.REFRESH_TOKEN, refreshToken, REFRESH_TOKEN_MAX_AGE)
    writeCookie(
      AUTH_STORAGE_KEYS.REFRESH_TOKEN_EXPIRES_AT,
      String(refreshTokenExpiresAt ?? Date.now() + REFRESH_TOKEN_MAX_AGE * 1000),
      REFRESH_TOKEN_MAX_AGE
    )
  }

  if (idToken) {
    writeCookie(AUTH_STORAGE_KEYS.ID_TOKEN, idToken, accessMaxAge)
  }
}

/**
 * Persist backend-issued auth tokens in cookies so they are available both to
 * the browser (axios interceptor) and to the server (`getSession` in
 * `handler.ts`).
 *
 * Writing tokens changes who the user is, so the cached session must go with
 * them: `getQueryClient().clear()` drops the stale "signed out" answer that
 * gates would otherwise reuse (the session query has no `staleTime` for exactly
 * this reason). `clear()` rather than `invalidateQueries` because every cached
 * query belongs to the previous identity — organizations, workspaces, storage
 * accounts — and must not survive a login or logout.
 */
export function setAuthTokens(tokens: AuthTokens) {
  writeTokens(tokens)
  getQueryClient().clear()
}

/**
 * Store a rotated token pair after a refresh. Same identity, so unlike
 * `setAuthTokens` the query cache is left alone — wiping it every access-token
 * lifetime would thrash every open screen.
 */
export function rotateAuthTokens(tokens: AuthTokens) {
  writeTokens(tokens)
}

/**
 * Persist a token pair returned by the backend's sign-in/refresh endpoints.
 * Accepts the current `expires_in` shape and the upcoming `expires_at` fields.
 */
export function persistTokenPair(payload: TokenPairResponse) {
  setAuthTokens({
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresIn: payload.expires_in,
    accessTokenExpiresAt: toEpochMs(payload.expires_at),
    refreshTokenExpiresAt: toEpochMs(payload.refresh_expires_at),
  })
}

/**
 * Same mapping as `persistTokenPair` but without the query-cache clear, for
 * refresh rotations.
 */
export function rotateTokenPair(payload: TokenPairResponse) {
  rotateAuthTokens({
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresIn: payload.expires_in,
    accessTokenExpiresAt: toEpochMs(payload.expires_at),
    refreshTokenExpiresAt: toEpochMs(payload.refresh_expires_at),
  })
}

/**
 * Normalize an `expires_at`-style value to epoch milliseconds. Accepts ISO
 * strings, unix seconds, and epoch milliseconds (numbers below ~2001-09-09 in
 * ms are assumed to be seconds).
 */
export function toEpochMs(value: string | number | undefined): number | undefined {
  if (value == null) return undefined

  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? undefined : parsed
  }

  return value < 1e12 ? value * 1000 : value
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
 * Access token expiry as epoch milliseconds, or null when unknown.
 */
export function getAccessTokenExpiresAt(): number | null {
  return readEpochCookie(AUTH_STORAGE_KEYS.ACCESS_TOKEN_EXPIRES_AT)
}

/**
 * Refresh token expiry as epoch milliseconds, or null when unknown.
 */
export function getRefreshTokenExpiresAt(): number | null {
  return readEpochCookie(AUTH_STORAGE_KEYS.REFRESH_TOKEN_EXPIRES_AT)
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
  removeCookie(AUTH_STORAGE_KEYS.USER)
  removeCookie(AUTH_STORAGE_KEYS.ACCESS_TOKEN_EXPIRES_AT)
  removeCookie(AUTH_STORAGE_KEYS.REFRESH_TOKEN_EXPIRES_AT)

  getQueryClient().clear()
}
