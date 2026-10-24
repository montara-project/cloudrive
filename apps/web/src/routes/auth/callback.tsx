import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'

import SessionLoading from '@/components/block/auth/session-loading'
import { exchangeMagicLinkToken } from '@/lib/auth/email-auth'
import { getSession } from '@/lib/auth/handler'

/**
 * Landing page for magic-link and OAuth2 sign-ins.
 *
 * - Magic link: Authula's /magic-link/verify redirects here with `?token=…`;
 *   we exchange it for a JWT pair via /magic-link/exchange.
 * - OAuth2: the provider callback lands here with no credential (the server
 *   is bearer-token only), so the session probe just fails to sign-in.
 */
export const Route = createFileRoute('/auth/callback')({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === 'string' ? search.token : undefined,
  }),
  head: () => ({ meta: [{ title: 'Signing in — Cloudrive' }] }),
  component: AuthCallbackPage,
})

function AuthCallbackPage() {
  const navigate = useNavigate()
  const { token } = Route.useSearch()
  const [error, setError] = useState<string | null>(null)
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const finish = async () => {
      if (token) {
        await exchangeMagicLinkToken(token)
        await navigate({ to: '/dashboard', replace: true })
        return
      }

      // OAuth2 landing: session cookie already set on the API domain.
      const session = await getSession()
      if (session) {
        await navigate({ to: '/dashboard', replace: true })
        return
      }

      setError('Sign-in could not be completed. Please try again.')
    }

    finish().catch((err) => {
      setError(err instanceof Error ? err.message : 'Sign-in failed')
    })
  }, [navigate, token])

  if (error) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <p className="font-medium text-destructive">{error}</p>
        <button
          className="text-sm text-primary underline underline-offset-4"
          onClick={() => void navigate({ to: '/sign-in', replace: true })}
        >
          Back to sign in
        </button>
      </main>
    )
  }

  return <SessionLoading message="Completing sign in…" />
}
