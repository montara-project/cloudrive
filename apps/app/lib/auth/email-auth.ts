import { env } from '@/config/env'

import { throwAxiosError } from '../api/axios-error'
import { services } from '../api/services'
import { setAuthTokens } from './token-storage'

interface SignInWithEmailParams {
  email: string
  password: string
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
  try {
    const res = await services.auth.signIn({ email, password })
    const payload = res?.data

    if (!payload?.access_token) {
      throw new Error('Sign-in response did not include an access token')
    }

    setAuthTokens({
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresIn: payload.expires_in,
    })

    return payload
  } catch (error) {
    throwAxiosError(error as Error)
  }
}

/**
 * Start the Google OAuth2 flow. Authula's authorize endpoint redirects the
 * browser to Google; `redirect_to` (validated against the server's trusted
 * origins) is where the callback lands afterwards — our /auth/callback page.
 */
export function signInWithGoogle() {
  const redirectTo = `${window.location.origin}/auth/callback`
  window.location.assign(
    `${env.NEXT_PUBLIC_API_URL}/v1/auth/oauth2/authorize/google?redirect_to=${encodeURIComponent(redirectTo)}`
  )
}

/**
 * Request a magic link email. `callback_url` is where Authula redirects after
 * the link is verified — it should point at the app's /auth/callback page.
 */
export async function signInWithMagicLink({ email }: { email: string }) {
  try {
    const callbackUrl = `${window.location.origin}/auth/callback`
    return await services.auth.magicLinkSignIn({ email, callback_url: callbackUrl })
  } catch (error) {
    throwAxiosError(error as Error)
  }
}

/**
 * Exchange the verified magic-link token (from the /auth/callback redirect)
 * for a JWT pair and store it.
 */
export async function exchangeMagicLinkToken(token: string) {
  try {
    const res = await services.auth.magicLinkExchange({ token })
    const payload = res?.data

    if (!payload?.access_token) {
      throw new Error('Exchange response did not include an access token')
    }

    setAuthTokens({
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresIn: payload.expires_in,
    })

    return payload
  } catch (error) {
    throwAxiosError(error as Error)
  }
}

export async function signOut() {
  try {
    await services.auth.signOut()
  } catch {
    // Session may already be gone server-side; local cleanup still proceeds.
  }
}
