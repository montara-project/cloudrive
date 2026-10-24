import { createFileRoute } from '@tanstack/react-router'

import StorageContent from '@/components/block/storage/content'

export const Route = createFileRoute('/(dashboard)/storage/')({
  head: () => ({ meta: [{ title: 'Storage Accounts | Cloudrive' }] }),
  component: StorageContent,
})
