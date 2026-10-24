import type { QueryClient } from '@tanstack/react-query'

import { TanStackDevtools } from '@tanstack/react-devtools'
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools'
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  useRouter,
  type ErrorComponentProps,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'

import StatusPage from '@/components/block/common/status-page'
import { Toaster } from '@/components/ui/sonner'
import DecorationProvider from '@/lib/providers/decoration'

/**
 * Root layout component that serves as the main wrapper for the application.
 *
 * Routing conventions:
 * - Use brackets for route grouping: (group)
 * - Prefix with `-` to ignore: -directory/ or -file.tsx
 * - File-based routing supported: e.g. students.add.tsx creates /students/add
 *
 * @see https://tanstack.com/router/latest/docs/framework/react/routing/routing-concepts
 */
const RootLayout = () => (
  <DecorationProvider>
    {/* SPA: index.html holds the site defaults; a route's `head` adds its own */}
    <HeadContent />
    <Outlet />
    <Toaster />

    {/* declare devtools panel */}
    {import.meta.env.DEV && (
      <TanStackDevtools
        config={{
          position: 'bottom-right',
        }}
        plugins={[
          {
            name: 'Tanstack Router',
            render: <TanStackRouterDevtoolsPanel />,
          },
          {
            name: 'Tanstack Query',
            render: <ReactQueryDevtoolsPanel />,
          },
        ]}
      />
    )}
  </DecorationProvider>
)

export interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFound,
  errorComponent: RootError,
})

function NotFound() {
  return (
    <StatusPage
      code="404"
      title="Page not found"
      description="The page you are looking for does not exist or has been moved."
    />
  )
}

function RootError({ error }: ErrorComponentProps) {
  const router = useRouter()
  // Raw messages can leak internals, so production shows a generic one.
  const description =
    import.meta.env.DEV && error instanceof Error
      ? error.message
      : 'An unexpected error occurred. Please try again.'

  return (
    <StatusPage
      code="Error"
      title="Something went wrong"
      description={description}
      action={
        // invalidate() re-runs the loaders and resets the error boundary.
        <button
          type="button"
          onClick={() => void router.invalidate()}
          className="rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground transition-colors duration-200 hover:border-primary/40"
        >
          Try again
        </button>
      }
    />
  )
}
