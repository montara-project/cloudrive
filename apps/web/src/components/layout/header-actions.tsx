import { IconBell, IconHelpCircle, IconLink, IconUserPlus } from '@tabler/icons-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { MOCK_MEMBER_TOTAL, MOCK_MEMBERS } from '@/data/mock/dashboard'
import { cn } from '@/lib/utils'

import UserMenu from './user-menu'

const AVATAR_TINTS = [
  'bg-blue-50 text-blue-600',
  'bg-amber-50 text-amber-600',
  'bg-violet-50 text-violet-600',
  'bg-emerald-50 text-emerald-600',
  'bg-rose-50 text-rose-600',
]

// The invite link the Invite button and the link icon both hand out.
const INVITE_URL = `${typeof window === 'undefined' ? '' : window.location.origin}/invite`

function copyInviteLink() {
  navigator.clipboard?.writeText(INVITE_URL).catch(() => {})
  toast.success('Invite link copied to clipboard')
}

/**
 * The right side of the top bar, shared by every signed-in page: the
 * workspace's social cluster (member stack, invite), then the link / help /
 * notifications trio and the account avatar (UserMenu).
 */
export default function HeaderActions() {
  return (
    <div className="ml-auto flex items-center gap-2">
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

      {/* Hidden below md: the icon trio + avatar already fill the small top
          bar, and the title needs the room. */}
      <Button variant="outline" onClick={copyInviteLink} className="hidden md:inline-flex">
        <IconUserPlus className="size-4" />
        Invite
      </Button>

      <span className="mx-1 hidden h-6 w-px bg-border md:block" aria-hidden="true" />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Copy invite link"
            onClick={copyInviteLink}
          >
            <IconLink className="size-4.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Copy invite link</TooltipContent>
      </Tooltip>
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
      <UserMenu />
    </div>
  )
}
