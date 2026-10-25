import { IconMoon, IconSun } from '@tabler/icons-react'
import { useNavigate } from '@tanstack/react-router'
import { BadgeCheck, LogOut } from 'lucide-react'
import { useTheme } from 'next-themes'

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
import { SIDEBAR_MENU } from '@/data/sidebar-menu'
import { useSession, useSignOut } from '@/hooks/use-session'

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
 * The top-bar account menu — an avatar button at the end of HeaderActions
 * (next to notifications) opening the account dropdown: identity, appearance,
 * account settings, sign out. Reads the session directly so any header can drop it
 * in without prop plumbing.
 */
export default function UserMenu() {
  const navigate = useNavigate()
  const { data: session } = useSession()
  const { signOut, isSigningOut } = useSignOut()
  const { resolvedTheme, setTheme } = useTheme()

  const user = session
    ? {
        name: [session.user.first_name, session.user.last_name].filter(Boolean).join(' ') || 'User',
        email: session.user.email,
        avatar: session.user.image ?? '',
      }
    : { ...SIDEBAR_MENU.user }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="cursor-pointer rounded-full outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Avatar className="size-8 rounded-full border border-border">
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback className="rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-56 rounded-xl" align="end" sideOffset={8}>
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <Avatar className="size-8 rounded-full">
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback className="rounded-full">{initials(user.name)}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs text-muted-foreground">{user.email}</span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
            {resolvedTheme === 'dark' ? <IconSun /> : <IconMoon />}
            {resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => navigate({ to: '/settings', search: { tab: 'account' } })}
          >
            <BadgeCheck />
            Account settings
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
