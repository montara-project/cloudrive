import { redirect } from 'next/navigation'

// Organizations live under Settings → Organizations now; keep the route as a
// redirect so old links still land in the right place.
export default function OrganizationsPage() {
  redirect('/settings?tab=organizations')
}
