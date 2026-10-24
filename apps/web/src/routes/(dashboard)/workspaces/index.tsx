import { createFileRoute, redirect } from '@tanstack/react-router'

// Workspaces live under Settings → Workspaces now; keep the route as a redirect so old links and bookmarks still land
// in the right place.
export const Route = createFileRoute('/(dashboard)/workspaces/')({
  beforeLoad: () => {
    throw redirect({ to: '/settings', search: { tab: 'workspaces' }, replace: true })
  },
})
