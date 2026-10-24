import { createFileRoute, redirect } from '@tanstack/react-router'

// Organizations live under Settings → Organizations now; keep the route as a redirect so old links and bookmarks still land
// in the right place.
export const Route = createFileRoute('/(dashboard)/organizations/')({
  beforeLoad: () => {
    throw redirect({ to: '/settings', search: { tab: 'organizations' }, replace: true })
  },
})
