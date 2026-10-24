'use client'

import { BadgeCheck, ChevronsUpDown, LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'

import type { UserInfo } from '@/types/menu'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSignOut } from '@/hooks/use-session'

type NavUserProps = {
  user: UserInfo
}

function initials(name: string) {
  return (
    name
      .split(' ')
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U'
  )
}

/**
 * The sidebar's user profile card — avatar, name, and email with the account
 * menu attached, sitting at the top of the main sidebar like the reference
 * shell. Replaces the old icon-rail avatar button.
 */
export default function NavUser({ user }: NavUserProps) {
  const router = useRouter()
  const { signOut, isSigningOut } = useSignOut()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-sidebar-border bg-background p-2 text-left shadow-xs transition-colors hover:bg-accent/60 data-[state=open]:bg-accent/60"
        >
          <Avatar className="size-9 rounded-lg">
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback className="rounded-lg bg-primary/10 text-xs font-semibold text-primary">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
          <span className="grid min-w-0 flex-1 leading-tight">
            <span className="truncate text-sm font-semibold">{user.name}</span>
            <span className="truncate text-xs text-muted-foreground">{user.email}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="min-w-(--radix-dropdown-menu-trigger-width) rounded-xl"
        align="start"
        sideOffset={6}
      >
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <Avatar className="size-8 rounded-lg">
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback className="rounded-lg">{initials(user.name)}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs text-muted-foreground">{user.email}</span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push('/settings?tab=account')}>
            <BadgeCheck />
            Account
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={isSigningOut} onClick={signOut}>
          <LogOut />
          {isSigningOut ? 'Signing out…' : 'Log out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
