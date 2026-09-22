import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { services } from '../services'
import { queryKeys } from './keys'

export function useWorkspaces(orgId: string | undefined, params?: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.workspaces.list(orgId ?? '', params),
    queryFn: () => services.workspace.list(orgId!, params).then((r) => r.data),
    enabled: !!orgId,
  })
}

export function useWorkspace(wsId: string) {
  return useQuery({
    queryKey: queryKeys.workspaces.detail(wsId),
    queryFn: () => services.workspace.get(wsId).then((r) => r.data),
    enabled: !!wsId,
  })
}

function useInvalidateWorkspaces() {
  const qc = useQueryClient()
  return (wsId?: string) => {
    qc.invalidateQueries({ queryKey: queryKeys.workspaces.all })
    if (wsId) qc.invalidateQueries({ queryKey: queryKeys.workspaces.detail(wsId) })
  }
}

export function useCreateWorkspace(orgId: string) {
  const invalidate = useInvalidateWorkspaces()
  return useMutation({
    mutationFn: (body: { name: string; slug: string; description?: string }) =>
      services.workspace.create(orgId, body).then((r) => r.data),
    onSuccess: () => invalidate(),
  })
}

export function useUpdateWorkspace(wsId: string) {
  const invalidate = useInvalidateWorkspaces()
  return useMutation({
    mutationFn: (body: { name?: string; description?: string }) =>
      services.workspace.update(wsId, body).then((r) => r.data),
    onSuccess: () => invalidate(wsId),
  })
}

export function useDeleteWorkspace() {
  const invalidate = useInvalidateWorkspaces()
  return useMutation({
    mutationFn: (wsId: string) => services.workspace.delete(wsId),
    onSuccess: () => invalidate(),
  })
}

// ── Members ────────────────────────────────────────────────────────────

export function useWorkspaceMembers(wsId: string, params?: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.workspaces.members(wsId, params),
    queryFn: () => services.workspace.listMembers(wsId, params).then((r) => r.data),
    enabled: !!wsId,
  })
}

function useInvalidateMembers(wsId: string) {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['workspaces', wsId, 'members'] })
}

export function useAddWorkspaceMember(wsId: string) {
  const invalidate = useInvalidateMembers(wsId)
  return useMutation({
    mutationFn: (body: { user_id: string; role: string }) =>
      services.workspace.addMember(wsId, body).then((r) => r.data),
    onSuccess: () => invalidate(),
  })
}

export function useUpdateWorkspaceMemberRole(wsId: string) {
  const invalidate = useInvalidateMembers(wsId)
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      services.workspace.updateMemberRole(wsId, userId, { role }).then((r) => r.data),
    onSuccess: () => invalidate(),
  })
}

export function useRemoveWorkspaceMember(wsId: string) {
  const invalidate = useInvalidateMembers(wsId)
  return useMutation({
    mutationFn: (userId: string) => services.workspace.removeMember(wsId, userId),
    onSuccess: () => invalidate(),
  })
}
