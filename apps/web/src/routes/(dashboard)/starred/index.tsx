import { createFileRoute } from '@tanstack/react-router'

import StarredContent from '@/components/block/drive/starred-content'

export const Route = createFileRoute('/(dashboard)/starred/')({
  head: () => ({ meta: [{ title: 'Starred | Cloudrive' }] }),
  component: StarredContent,
})
