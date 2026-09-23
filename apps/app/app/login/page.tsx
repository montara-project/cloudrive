import type { Metadata } from 'next'

import LoginGate from '@/components/block/auth/login-gate'

export const metadata: Metadata = {
  title: 'Sign in — Cloudrive',
}

export default function LoginPage() {
  return <LoginGate />
}
