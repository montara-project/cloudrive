'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef, useState } from 'react'

import SessionLoading from '@/components/block/auth/session-loading'
import { exchangeMagicLinkToken } from '@/lib/auth/email-auth'
import { getSession } from '@/lib/auth/handler'

/**
 * Landing page for magic-link and OAuth2 sign-ins.
 *
 * - Magic link: Authula's /magic-link/verify redirects here with `?token=…`;
 *   we exchange it for a JWT pair via /magic-link/exchange.
 * - OAuth2: the provider callback lands here with only the API-domain session
 *   cookie set, so we resolve the session via GET /v1/me instead.
 */
function CallbackInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const finish = async () => {
      const token = searchParams.get('token')

      if (token) {
        await exchangeMagicLinkToken(token)
        router.replace('/dashboard')
        return
      }

      // OAuth2 landing: session cookie already set on the API domain.
      const session = await getSession()
      if (session) {
        router.replace('/dashboard')
        return
      }

      setError('Sign-in could not be completed. Please try again.')
    }

    finish().catch((err) => {
      setError(err instanceof Error ? err.message : 'Sign-in failed')
    })
  }, [router, searchParams])

  if (error) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <p className="font-medium text-destructive">{error}</p>
        <button
          className="text-sm text-primary underline underline-offset-4"
          onClick={() => router.replace('/login')}
        >
          Back to sign in
        </button>
      </main>
    )
  }

  return <SessionLoading message="Completing sign in…" />
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<SessionLoading message="Completing sign in…" />}>
      <CallbackInner />
    </Suspense>
  )
}
