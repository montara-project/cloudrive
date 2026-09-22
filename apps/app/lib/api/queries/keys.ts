export const queryKeys = {
  me: ['me'] as const,
  providers: ['providers'] as const,
  organizations: {
    all: ['organizations'] as const,
    list: (params?: Record<string, unknown>) => ['organizations', 'list', params] as const,
    detail: (orgId: string) => ['organizations', 'detail', orgId] as const,
    members: (orgId: string, params?: Record<string, unknown>) =>
      ['organizations', orgId, 'members', params] as const,
    invitations: (orgId: string, params?: Record<string, unknown>) =>
      ['organizations', orgId, 'invitations', params] as const,
  },
  workspaces: {
    all: ['workspaces'] as const,
    list: (orgId: string, params?: Record<string, unknown>) =>
      ['workspaces', 'list', orgId, params] as const,
    detail: (wsId: string) => ['workspaces', 'detail', wsId] as const,
    members: (wsId: string, params?: Record<string, unknown>) =>
      ['workspaces', wsId, 'members', params] as const,
  },
  storageAccounts: {
    list: (wsId: string, params?: Record<string, unknown>) =>
      ['storage-accounts', 'list', wsId, params] as const,
    detail: (accountId: string) => ['storage-accounts', 'detail', accountId] as const,
  },
  s3: {
    credentials: (wsId: string) => ['s3', wsId, 'credentials'] as const,
    buckets: (wsId: string) => ['s3', wsId, 'buckets'] as const,
  },
} as const
