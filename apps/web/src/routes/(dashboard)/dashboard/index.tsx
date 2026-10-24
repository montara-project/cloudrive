import { createFileRoute } from '@tanstack/react-router'

import DashboardContent from '@/components/block/dashboard/content'

export const Route = createFileRoute('/(dashboard)/dashboard/')({
  head: () => ({ meta: [{ title: 'Dashboard | Cloudrive' }] }),
  component: DashboardContent,
})
