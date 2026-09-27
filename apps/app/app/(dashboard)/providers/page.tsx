import { Metadata } from 'next'

import ProviderContent from '@/components/block/providers/content'
import { META } from '@/lib/constants/meta'

export const metadata: Metadata = {
  ...META,
  title: 'Providers | Cloudrive',
}

export default function ProvidersPage() {
  return <ProviderContent />
}
