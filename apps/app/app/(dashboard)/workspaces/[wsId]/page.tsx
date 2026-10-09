import { Metadata } from 'next'

import WorkspaceDetailContent from '@/components/block/workspaces/detail-content'
import { META } from '@/lib/constants/meta'

export const metadata: Metadata = {
  ...META,
  title: 'Workspace | Cloudrive',
}

export default async function WorkspaceDetailPage({
  params,
}: {
  params: Promise<{ wsId: string }>
}) {
  const { wsId } = await params
  return <WorkspaceDetailContent wsId={wsId} />
}
