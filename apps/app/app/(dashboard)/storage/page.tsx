import { Metadata } from 'next'

import StorageContent from '@/components/block/storage/content'
import { META } from '@/lib/constants/meta'

export const metadata: Metadata = {
  ...META,
  title: 'Storage Accounts | Cloudrive',
}

export default function StoragePage() {
  return <StorageContent />
}
