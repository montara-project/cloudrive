import { Metadata } from 'next'

import RecentContent from '@/components/block/drive/recent-content'
import { META } from '@/lib/constants/meta'

export const metadata: Metadata = {
  ...META,
  title: 'Recent | Cloudrive',
}

export default function RecentPage() {
  return <RecentContent />
}
