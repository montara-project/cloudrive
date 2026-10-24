import { createFileRoute } from '@tanstack/react-router'

import SettingContent from '@/components/block/settings/content'

export const Route = createFileRoute('/(dashboard)/settings/')({
  head: () => ({ meta: [{ title: 'Settings | Cloudrive' }] }),
  // ?tab= / ?view= are read by the settings panels through nuqs; declared here
  // so navigate({ to: '/settings', search: { tab } }) type-checks.
  validateSearch: (search: Record<string, unknown>) => search as { tab?: string; view?: string },
  component: SettingContent,
})
