import { createFileRoute } from '@tanstack/react-router'

import DriveContent from '@/components/block/drive/content'

export const Route = createFileRoute('/(dashboard)/drive/')({
  head: () => ({ meta: [{ title: 'My Drive | Cloudrive' }] }),
  component: DriveContent,
})
