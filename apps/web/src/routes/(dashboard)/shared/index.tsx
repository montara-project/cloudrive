import { createFileRoute } from '@tanstack/react-router'

import SharedContent from '@/components/block/drive/shared-content'

export const Route = createFileRoute('/(dashboard)/shared/')({
  head: () => ({ meta: [{ title: 'Shared | Cloudrive' }] }),
  component: SharedContent,
})
