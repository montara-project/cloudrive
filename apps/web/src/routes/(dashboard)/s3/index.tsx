import { createFileRoute } from '@tanstack/react-router'

import S3Content from '@/components/block/s3/content'

export const Route = createFileRoute('/(dashboard)/s3/')({
  head: () => ({ meta: [{ title: 'S3 Gateway | Cloudrive' }] }),
  component: S3Content,
})
