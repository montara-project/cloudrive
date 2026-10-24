import { createFileRoute } from '@tanstack/react-router'

import SettingContent from '@/components/block/settings/content'

export const Route = createFileRoute('/(dashboard)/settings/')({
  head: () => ({ meta: [{ title: 'Settings | Cloudrive' }] }),
  // ?tab= / ?view= (and the workspace scope ?org/?ws, the S3 ?bucket) are read
  // by the settings panels through nuqs; declared here so typed navigation to
  // /settings with those params type-checks. Values pass through unchanged.
  validateSearch: (search: Record<string, unknown>) =>
    search as { tab?: string; view?: string; org?: string; ws?: string; bucket?: string },
  component: SettingContent,
})
