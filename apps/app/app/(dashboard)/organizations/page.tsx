import { Metadata } from 'next'

import OrganizationContent from '@/components/block/organizations/content'
import { META } from '@/lib/constants/meta'

export const metadata: Metadata = {
  ...META,
  title: 'Organizations | Cloudrive',
}

export default function OrganizationsPage() {
  return <OrganizationContent />
}
