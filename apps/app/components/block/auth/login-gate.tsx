'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import SessionLoading from '@/components/block/auth/session-loading'
import { useHydrated } from '@/hooks/use-hydrated'
import { useSession } from '@/hooks/use-session'

import LoginSection from './login-section'

/**
 * Sign-in screen, gated on the session probe.
 *
 * An already-authenticated visitor goes straight to the dashboard; the form is
 * only rendered once we know nobody is signed in, so it never flashes on screen
 * for a returning user mid-redirect.
 */
export default function LoginGate() {
  const router = useRouter()
  const hydrated = useHydrated()
  const { data: session, isPending } = useSession()

  // A session — even the optimistic snapshot — means straight to the
  // dashboard; the dashboard's own probe bounces back here if it's stale.
  useEffect(() => {
    if (session) {
      router.replace('/dashboard')
    }
  }, [session, router])

  // `!hydrated` keeps the hydration pass identical to the server render (the
  // optimistic session is client-only); the message is gated on `hydrated`
  // for the same reason — its text must match what SSR emitted.
  if (!hydrated || isPending || session) {
    return (
      <SessionLoading message={hydrated && session ? 'Taking you to your drive…' : undefined} />
    )
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="animate-in fade-in-0 slide-in-from-bottom-1 w-full max-w-lg p-8 duration-300">
        <LoginSection />
      </div>
    </main>
  )
}
