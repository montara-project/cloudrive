import { IconBell, IconHelpCircle, IconSettings, IconUserPlus } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'

import ThemeToggle from '@/components/layout/theme-toggle'
import UserMenu from '@/components/layout/user-menu'
import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { MOCK_MEMBER_TOTAL, MOCK_MEMBERS, MOCK_USER } from '@/data/mock/dashboard'
import { useSession } from '@/hooks/use-session'
import { cn } from '@/lib/utils'

const AVATAR_TINTS = [
  'bg-blue-50 text-blue-600',
  'bg-amber-50 text-amber-600',
  'bg-violet-50 text-violet-600',
  'bg-emerald-50 text-emerald-600',
  'bg-rose-50 text-rose-600',
]

/**
 * The dashboard's own page header — welcome message on the left, the
 * workspace's social cluster (member stack, invite, utilities) on the right,
 * replacing the old global top bar.
 */
export default function WelcomeHeader() {
  const { data: session } = useSession()
  const firstName = session?.user.first_name ?? MOCK_USER.name.split(' ')[0]

  const invite = () => {
    navigator.clipboard?.writeText(`${window.location.origin}/invite`).catch(() => {})
    toast.success('Invite link copied to clipboard')
  }

  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <SidebarTrigger className="mt-1.5 lg:hidden" />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight">
            Welcome back, {firstName} 👋
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your files are safe, organized, and always accessible.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="mr-1 hidden items-center md:flex" aria-hidden="true">
          {MOCK_MEMBERS.slice(0, 4).map((member, index) => (
            <span
              key={member.id}
              title={member.name}
              className={cn(
                '-ml-1.5 flex size-8 items-center justify-center rounded-full border-2 border-background text-xs font-semibold first:ml-0',
                AVATAR_TINTS[index % AVATAR_TINTS.length]
              )}
            >
              {member.initials}
            </span>
          ))}
          <span className="-ml-1.5 flex size-8 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-semibold text-muted-foreground">
            +{MOCK_MEMBER_TOTAL}
          </span>
        </div>

        <Button variant="outline" onClick={invite}>
          <IconUserPlus className="size-4" />
          Invite
        </Button>

        <span className="mx-1 hidden h-6 w-px bg-border md:block" aria-hidden="true" />

        <ThemeToggle />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" asChild>
              <a href="https://cloudrive.us.ci" target="_blank" rel="noreferrer" aria-label="Help">
                <IconHelpCircle className="size-4.5" />
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Help center</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Notifications"
              onClick={() => toast("You're all caught up!")}
            >
              <span className="relative">
                <IconBell className="size-4.5" />
                <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-red-500 ring-2 ring-background" />
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Notifications</TooltipContent>
        </Tooltip>
        <Button variant="ghost" size="icon" asChild>
          <Link to="/settings" aria-label="Settings">
            <IconSettings className="size-4.5" />
          </Link>
        </Button>
        <UserMenu />
      </div>
    </header>
  )
}
