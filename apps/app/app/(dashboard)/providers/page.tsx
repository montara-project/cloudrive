import { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { META } from '@/lib/constants/meta'

export const metadata: Metadata = {
  ...META,
  title: 'Providers | Cloudrive',
}

/**
 * Providers moved under Settings → Storage → Providers; keep this route as a
 * redirect so existing links and bookmarks land on the new tab instead of
 * dead-ending.
 */
export default function ProvidersPage() {
  redirect('/settings?view=providers')
}
