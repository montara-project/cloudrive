import { createFileRoute } from '@tanstack/react-router'

import OrganizationDetailContent from '@/components/block/organizations/detail-content'

export const Route = createFileRoute('/(dashboard)/organizations/$orgId')({
  head: () => ({ meta: [{ title: 'Organization | Cloudrive' }] }),
  component: () => <OrganizationDetailContent orgId={Route.useParams().orgId} />,
})
