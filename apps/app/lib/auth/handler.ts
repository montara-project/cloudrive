import type { AuthSession } from '@/types/auth'

import { env } from '@/config/env'

import type { Models } from '../api/models'

import { getStoredAccessToken, getStoredRefreshToken } from './token-storage'

/**
 * Read the session issued by our own backend.
 *
 * Identity is resolved via `GET /v1/me` using the Bearer access token stored
 * in cookies by `token-storage.ts`. The server authenticates by bearer token
 * only — there is no session-cookie fallback.
 */
async function getBackendSession(): Promise<AuthSession | null> {
  const accessToken = getStoredAccessToken()
  const refreshToken = getStoredRefreshToken()

  try {
    const res = await fetch(`${env.NEXT_PUBLIC_API_URL}/v1/me`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      cache: 'no-store',
    })

    if (!res.ok) {
      return null
    }

    const user = (await res.json()) as Models.User

    return {
      user,
      session: { token: accessToken ?? '' },
      data: {
        accessToken: accessToken ?? undefined,
        refreshToken: refreshToken ?? undefined,
        provider: accessToken ? 'custom' : 'google',
      },
    }
  } catch (error) {
    console.error('Backend session error:', (error as Error).message)
    return null
  }
}

/**
 * Get current session.
 * @returns Session object or null if not authenticated.
 */
export async function getSession(): Promise<AuthSession | null> {
  return getBackendSession()
}
