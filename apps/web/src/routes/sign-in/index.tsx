import { createFileRoute } from '@tanstack/react-router'

import LoginGate from '@/components/block/auth/login-gate'

export const Route = createFileRoute('/sign-in/')({
  head: () => ({ meta: [{ title: 'Sign in — Cloudrive' }] }),
  component: LoginGate,
})
