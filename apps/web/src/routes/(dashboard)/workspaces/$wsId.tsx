import { createFileRoute } from '@tanstack/react-router'

import WorkspaceDetailContent from '@/components/block/workspaces/detail-content'

export const Route = createFileRoute('/(dashboard)/workspaces/$wsId')({
  head: () => ({ meta: [{ title: 'Workspace | Cloudrive' }] }),
  component: () => <WorkspaceDetailContent wsId={Route.useParams().wsId} />,
})
