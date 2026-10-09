import { Metadata } from 'next'

import StarredContent from '@/components/block/drive/starred-content'
import { META } from '@/lib/constants/meta'

export const metadata: Metadata = {
  ...META,
  title: 'Starred | Cloudrive',
}

export default function StarredPage() {
  return <StarredContent />
}
