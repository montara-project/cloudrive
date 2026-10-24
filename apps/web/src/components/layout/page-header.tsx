import { IconBell, IconHelpCircle, IconSettings } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'

import ThemeToggle from '@/components/layout/theme-toggle'
import UserMenu from '@/components/layout/user-menu'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface PageHeaderProps {
  title: React.ReactNode
  description?: React.ReactNode
  /** Icon tile or back button shown before the title. */
  leading?: React.ReactNode
  /** Page actions, shown before the utility cluster. */
  actions?: React.ReactNode
}

/**
 * The header every signed-in page shares with the dashboard: sidebar trigger,
 * title and description on the left; page actions and the utility cluster on
 * the right; a separator underneath.
 */
export default function PageHeader({ title, description, leading, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <SidebarTrigger className="mt-1.5 lg:hidden" />
          {leading}
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight">{title}</h1>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {actions}
          {actions && (
            <span className="mx-1 hidden h-6 w-px bg-border md:block" aria-hidden="true" />
          )}
          <ThemeToggle />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" asChild>
                <a
                  href="https://cloudrive.us.ci"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Help"
                >
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
      <Separator />
    </div>
  )
}
