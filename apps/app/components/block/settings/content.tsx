'use client'

import { useQueryState } from 'nuqs'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSession, useSignOut } from '@/hooks/use-session'

import SectionCard from '../common/section-card'
import OrganizationContent from '../organizations/content'
import WorkspaceContent from '../workspaces/content'

export default function SettingContent() {
  // Tab lives in `?tab=` so links can deep-link a panel; the default stays
  // out of the URL to keep it clean.
  const [tab, setTab] = useQueryState('tab')

  return (
    <Tabs
      value={tab ?? 'account'}
      onValueChange={(value) => setTab(value === 'account' ? null : value)}
      className="flex flex-col gap-4"
    >
      <TabsList className="w-fit">
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="organizations">Organizations</TabsTrigger>
        <TabsTrigger value="workspaces">Workspaces</TabsTrigger>
      </TabsList>

      <TabsContent value="account">
        <AccountCard />
      </TabsContent>
      <TabsContent value="organizations" className="mt-0">
        <OrganizationContent />
      </TabsContent>
      <TabsContent value="workspaces" className="mt-0">
        <WorkspaceContent />
      </TabsContent>
    </Tabs>
  )
}

function AccountCard() {
  const { data: session, isLoading } = useSession()
  const { signOut, isSigningOut } = useSignOut()

  const user = session?.user

  return (
    <SectionCard title="Account" description="Your account and session.">
      {isLoading ? (
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
              <dd className="capitalize">{session?.data.provider ?? '—'}</dd>
            </div>
          </dl>

          <div className="border-t border-border pt-4">
            <Button variant="destructive" size="sm" disabled={isSigningOut} onClick={signOut}>
              {isSigningOut ? 'Signing out…' : 'Sign out'}
            </Button>
          </div>
        </div>
      )}
    </SectionCard>
  )
}
