import { Metadata } from 'next'

import SettingContent from '@/components/block/settings/content'
import { META } from '@/lib/constants/meta'

export const metadata: Metadata = {
  ...META,
  title: 'Settings | Cloudrive',
}

export default function SettingsPage() {
  return <SettingContent />
}
