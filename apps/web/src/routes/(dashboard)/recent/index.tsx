import { createFileRoute } from '@tanstack/react-router'

import RecentContent from '@/components/block/drive/recent-content'

export const Route = createFileRoute('/(dashboard)/recent/')({
  head: () => ({ meta: [{ title: 'Recent | Cloudrive' }] }),
  component: RecentContent,
})
