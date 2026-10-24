import { queryOptions } from '@tanstack/react-query'

import { services } from '../services'

export const DRIVE_LIST_QUERY_KEY = (wsId: string, prefix?: string) => {
  return ['drive', wsId, prefix ?? '']
}

// driveEntries lists one level of the workspace's provider drives. The
// provider fan-out is the server's concern — this query just caches the
// merged listing per prefix for the My Drive browser.
const list = (wsId: string, prefix?: string) =>
  queryOptions({
    queryKey: DRIVE_LIST_QUERY_KEY(wsId, prefix),
    queryFn: async () => {
      const res = await services.s3.drive.list(wsId, { prefix, limit: 200 })
      return res.data
    },
    enabled: !!wsId,
    staleTime: 60 * 1000,
    retry: false,
  })

export const driveQueries = {
  list,
} as const
