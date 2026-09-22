'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import SectionCard from '@/components/block/common/section-card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { signOut } from '@/lib/auth/email-auth'
import { getSession } from '@/lib/auth/handler'
import { clearAuthTokens } from '@/lib/auth/token-storage'

export default function SettingsPage() {
  const router = useRouter()
  const session = useQuery({ queryKey: ['me'], queryFn: getSession })

  const user = session.data?.user

  const handleSignOut = async () => {
    try {
      await signOut()
    } finally {
      clearAuthTokens()
      toast.success('Signed out')
      router.replace('/login')
    }
  }

  return (
    <SectionCard title="Settings" description="Your account and session.">
      {session.isLoading ? (
        <div className="py-10 text-center">
          <span className="inline-block size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : !user ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Could not load your profile.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <Avatar className="size-14 rounded-lg">
              <AvatarImage src={user.image} alt={user.first_name} />
              <AvatarFallback className="rounded-lg text-lg">
                {(user.first_name?.[0] ?? user.email[0] ?? 'U').toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-lg font-medium">
                {[user.first_name, user.last_name].filter(Boolean).join(' ') || user.email}
              </p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">User ID</dt>
              <dd className="font-mono text-xs">{user.id}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Member since</dt>
              <dd>{user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Sign-in method</dt>
              <dd className="capitalize">{session.data?.data.provider ?? '—'}</dd>
            </div>
          </dl>

          <div className="border-t border-border pt-4">
            <Button variant="destructive" size="sm" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        </div>
      )}
    </SectionCard>
  )
}
