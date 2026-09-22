import type { Metadata } from 'next'

import LoginSection from '@/components/block/auth/login-section'

export const metadata: Metadata = {
  title: 'Sign in — Cloudrive',
}

export default function LoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-xs">
        <LoginSection />
      </div>
    </main>
  )
}
