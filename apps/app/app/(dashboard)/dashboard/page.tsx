import { Metadata } from 'next'

import DashboardContent from '@/components/block/dashboard/content'
import { META } from '@/lib/constants/meta'

export const metadata: Metadata = {
  ...META,
  title: 'Dashboard | Cloudrive',
}

export default function DashboardPage() {
  return <DashboardContent />
}
