import { Metadata } from 'next'

import DriveContent from '@/components/block/drive/content'
import { META } from '@/lib/constants/meta'

export const metadata: Metadata = {
  ...META,
  title: 'My Drive | Cloudrive',
}

export default function DrivePage() {
  return <DriveContent />
}
