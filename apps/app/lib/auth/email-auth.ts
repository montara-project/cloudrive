import { env } from '@/config/env'

import { authClient } from './client'
import { persistTokenPair } from './token-storage'

interface SignInWithEmailParams {
  email: string
  password: string
}

/**
 * Normalize a better-fetch `{ error }` into a thrown Error with a readable
 * message, matching what callers used to get from the axios path. The server's
 * error body (e.g. `{"message": "Invalid credentials"}`) rides on
 * `error.error`.
 */
function throwAuthError(error: {
  status?: number
  statusText?: string
  message?: string
  error?: { message?: string }
}): never {
  throw new Error(
    error.error?.message || error.message || error.statusText || 'Authentication request failed'
  )
}

/**
 * Authenticate against the backend (NEXT_PUBLIC_API_URL) with email + password.
 * Authula's jwt.respond_json returns the token pair at the top level of the
 * response body; the tokens are stored and attached to subsequent API requests
 * by the axios interceptor in `client-fetch.ts`.
 *
 * `setAuthTokens` invalidates the cached session, so the next gate render
 * re-probes instead of reusing the "signed out" answer from the login page.
 */
export async function signInWithEmail({ email, password }: SignInWithEmailParams) {
  const { data, error } = await authClient.signInEmail({ email, password })

  if (error) {
    throwAuthError(error)
  }

  if (!data?.access_token) {
    throw new Error('Sign-in response did not include an access token')
  }

  persistTokenPair(data)
  return data
}

/**
 * Start the Google OAuth2 flow. Authula's authorize endpoint redirects the
 * browser to Google; `redirect_to` (validated against the server's trusted
 * origins) is where the callback lands afterwards — our /auth/callback page.
 */
export function signInWithGoogle() {
  const redirectTo = `${window.location.origin}/auth/callback`
  window.location.href = `${env.NEXT_PUBLIC_API_URL}/v1/auth/oauth2/authorize/google?redirect_to=${encodeURIComponent(redirectTo)}`
}

/**
 * Request a magic link email. `callback_url` is where Authula redirects after
 * the link is verified — it should point at the app's /auth/callback page.
 */
export async function signInWithMagicLink({ email }: { email: string }) {
  const callbackUrl = `${window.location.origin}/auth/callback`
  const { data, error } = await authClient.magicLinkSignIn({ email, callback_url: callbackUrl })

  if (error) {
    throwAuthError(error)
  }

  return data
}

/**
 * Exchange the verified magic-link token (from the /auth/callback redirect)
 * for a JWT pair and store it.
 */
export async function exchangeMagicLinkToken(token: string) {
  const { data, error } = await authClient.magicLinkExchange({ token })

  if (error) {
    throwAuthError(error)
  }

  if (!data?.access_token) {
    throw new Error('Exchange response did not include an access token')
  }

  persistTokenPair(data)
  return data
}

export async function signOut() {
  try {
    await authClient.authSignOut()
  } catch {
    // Session may already be gone server-side; local cleanup still proceeds.
  }
}
