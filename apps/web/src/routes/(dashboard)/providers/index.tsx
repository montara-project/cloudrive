import { createFileRoute, redirect } from '@tanstack/react-router'

// Providers moved under Settings → Storage → Providers; keep the route as a redirect so old links and bookmarks still land
// in the right place.
export const Route = createFileRoute('/(dashboard)/providers/')({
  beforeLoad: () => {
    throw redirect({ to: '/settings', search: { view: 'providers' }, replace: true })
  },
})
