import { Metadata } from 'next'

import WorkspaceContent from '@/components/block/workspaces/content'
import { META } from '@/lib/constants/meta'

export const metadata: Metadata = {
  ...META,
  title: 'Workspaces | Cloudrive',
}

export default function WorkspacesPage() {
  return <WorkspaceContent />
}
