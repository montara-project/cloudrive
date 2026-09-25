import { Metadata } from 'next'

import OrganizationDetailContent from '@/components/block/organizations/detail-content'
import { META } from '@/lib/constants/meta'

export const metadata: Metadata = {
  ...META,
  title: 'Organization | Cloudrive',
}

interface OrganizationParams {
  params: Promise<{ orgId: string }>
}

export default async function OrganizationDetailPage({ params }: OrganizationParams) {
  const { orgId } = await params
  return <OrganizationDetailContent orgId={orgId} />
}
