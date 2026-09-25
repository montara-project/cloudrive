import type { BetterAuthClientPlugin } from 'better-auth/client'

import { createAuthClient } from 'better-auth/client'

import { env } from '@/config/env'

import type { MagicLinkDto, RefreshDto, SignInDto } from '../api/dtos/auth/schema'
import type { TokenPairResponse } from '../api/dtos/auth/types'
import type { Models } from '../api/models'

import { getStoredAccessToken } from './token-storage'

/**
 * Custom client plugin that maps Authula's endpoints onto the better-auth
 * client. The backend is not a better-auth server, so the built-in
 * signIn/signOut proxies can't be used — these actions give the same
 * ergonomics (typed methods on `authClient`) against the real routes.
 */
const authulaClient = {
  id: 'authula',
  getActions: ($fetch) => ({
    /** Application profile for the bearer token — the /v1/me session probe. */
    me: () => $fetch<Models.User>('/v1/me'),
    signInEmail: (body: SignInDto) =>
      $fetch<TokenPairResponse>('/v1/auth/email-password/sign-in', { method: 'POST', body }),
    magicLinkSignIn: (body: MagicLinkDto & { callback_url: string }) =>
      $fetch<{ message?: string }>('/v1/auth/magic-link/sign-in', { method: 'POST', body }),
    magicLinkExchange: (body: { token: string }) =>
      $fetch<TokenPairResponse>('/v1/auth/magic-link/exchange', { method: 'POST', body }),
    refreshTokenPair: (body: RefreshDto) =>
      $fetch<TokenPairResponse>('/v1/auth/token/refresh', { method: 'POST', body }),
    authSignOut: () => $fetch('/v1/auth/sign-out', { method: 'POST' }),
  }),
} satisfies BetterAuthClientPlugin

/**
 * better-auth client used as the app's auth transport. `basePath: '/'` keeps
 * $fetch paths as real server routes (`/v1/me`, `/v1/auth/...`) instead of
 * better-auth's default `/api/auth` prefix.
 *
 * The bearer token is read per request from cookie storage; callers that need
 * a guaranteed-fresh token go through `getValidAccessToken` in `refresh.ts`
 * first (the axios interceptor and the session probe already do).
 */
export const authClient = createAuthClient({
  baseURL: String(env.NEXT_PUBLIC_API_URL),
  basePath: '/',
  fetchOptions: {
    auth: {
      type: 'Bearer',
      token: () => getStoredAccessToken() ?? undefined,
    },
  },
  plugins: [authulaClient],
})
