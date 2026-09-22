'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef, useState } from 'react'

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

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      {error ? (
        <>
          <p className="font-medium text-destructive">{error}</p>
          <button
            className="text-sm text-primary underline underline-offset-4"
            onClick={() => router.replace('/login')}
          >
            Back to sign in
          </button>
        </>
      ) : (
        <>
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Completing sign in…</p>
        </>
      )}
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6">
      <Suspense
        fallback={
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        }
      >
        <CallbackInner />
      </Suspense>
    </main>
  )
}
