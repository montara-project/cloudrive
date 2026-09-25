'use client'

import {
  defaultShouldDehydrateQuery,
  environmentManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'

const STALE_TIME_QUERY = 5 * 60 * 1000 // 5 minutes

/**
 * Make query client
 * @returns
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME_QUERY,
        // Revalidate stale queries when the tab regains focus. The session query
        // sets `staleTime: 0`, so returning to a tab whose token has since
        // expired re-probes /v1/me and the gate redirects, instead of leaving
        // the user on a dashboard whose every request 401s.
        refetchOnWindowFocus: true,
      },
      dehydrate: {
        // include pending queries in dehydration
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === 'pending',
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined = undefined

/**
 * Get query client
 * @returns
 */
export function getQueryClient() {
  if (environmentManager.isServer()) {
    // Server: always make a new query client
    return makeQueryClient()
  } else {
    // Browser: make a new query client if we don't already have one
    // This is very important, so we don't re-make a new client if React
    // suspends during the initial render. This may not be needed if we
    // have a suspense boundary BELOW the creation of the query client
    if (!browserQueryClient) browserQueryClient = makeQueryClient()
    return browserQueryClient
  }
}

/**
 * React query provider
 * @param params
 * @returns
 */
export default function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
