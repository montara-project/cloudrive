import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      // Revalidate stale queries when the tab regains focus. The session query
      // sets `staleTime: 0`, so returning to a tab whose token has since
      // expired re-probes /v1/me and the gate redirects, instead of leaving
      // the user on a dashboard whose every request 401s.
      refetchOnWindowFocus: true,
    },
  },
})

/** The app's single query client, shared with the router context. */
export function getQueryClient() {
  return queryClient
}

export default function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
