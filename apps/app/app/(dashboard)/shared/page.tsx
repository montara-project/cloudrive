import { Metadata } from 'next'

import SharedContent from '@/components/block/drive/shared-content'
import { META } from '@/lib/constants/meta'

export const metadata: Metadata = {
  ...META,
  title: 'Shared | Cloudrive',
}

export default function SharedPage() {
  return <SharedContent />
}
