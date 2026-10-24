import { IconUserPlus } from '@tabler/icons-react'
import { toast } from 'sonner'

import PageHeader from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
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
 * The dashboard's page header: the shared PageHeader with a welcome message
 * and the workspace's social cluster (member stack, invite) as its actions.
 */
export default function WelcomeHeader() {
  const { data: session } = useSession()
  const firstName = session?.user.first_name ?? MOCK_USER.name.split(' ')[0]

  const invite = () => {
    navigator.clipboard?.writeText(`${window.location.origin}/invite`).catch(() => {})
    toast.success('Invite link copied to clipboard')
  }

  return (
    <PageHeader
      title={`Welcome back, ${firstName} 👋`}
      description="Your files are safe, organized, and always accessible."
      actions={
        <>
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
        </>
      }
    />
  )
}
