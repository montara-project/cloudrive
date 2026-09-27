import { redirect } from 'next/navigation'

// Workspaces live under Settings → Workspaces now; keep the route as a
// redirect so old links still land in the right place.
export default function WorkspacesPage() {
  redirect('/settings?tab=workspaces')
}
