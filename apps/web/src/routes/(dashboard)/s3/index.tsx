import { createFileRoute, redirect } from '@tanstack/react-router'

// The S3 gateway lives under Settings → S3 Gateway now; keep the route as a
// redirect so old links and bookmarks still land in the right place, with
// their workspace (?org/?ws) and bucket deep link (?view/?bucket) intact.
export const Route = createFileRoute('/(dashboard)/s3/')({
  beforeLoad: ({ search }) => {
    throw redirect({ to: '/settings', search: { ...search, tab: 's3' }, replace: true })
  },
})
