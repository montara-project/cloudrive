import { Separator } from '@/components/ui/separator'

interface PageHeaderProps {
  title: React.ReactNode
  description?: React.ReactNode
  /** Icon tile or back button shown before the title. */
  leading?: React.ReactNode
  /** Page actions, shown on the right. */
  actions?: React.ReactNode
}

/**
 * The header every signed-in page shares with the dashboard: title and
 * description on the left, page actions on the right, a separator underneath.
 * The utility cluster (members, invite, link / help / notifications) lives in
 * the top bar (HeaderActions), not here.
 */
export default function PageHeader({ title, description, leading, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {leading}
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight">{title}</h1>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>

        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </header>
      <Separator />
    </div>
  )
}
