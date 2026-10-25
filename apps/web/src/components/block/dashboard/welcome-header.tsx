import PageHeader from '@/components/layout/page-header'
import { MOCK_USER } from '@/data/mock/dashboard'
import { useSession } from '@/hooks/use-session'

/**
 * The dashboard's page header: the shared PageHeader with a welcome message.
 * The member stack and Invite live in the top bar (HeaderActions).
 */
export default function WelcomeHeader() {
  const { data: session } = useSession()
  const firstName = session?.user.first_name ?? MOCK_USER.name.split(' ')[0]

  return (
    <PageHeader
      title={`Welcome back, ${firstName} 👋`}
      description="Your files are safe, organized, and always accessible."
    />
  )
}
