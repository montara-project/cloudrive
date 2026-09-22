import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Models } from '../models'

import { services } from '../services'
import { queryKeys } from './keys'

export function useOrganizations(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.organizations.list(params),
    queryFn: () => services.organization.list(params).then((r) => r.data),
  })
}

export function useOrganization(orgId: string) {
  return useQuery({
    queryKey: queryKeys.organizations.detail(orgId),
    queryFn: () => services.organization.get(orgId).then((r) => r.data),
    enabled: !!orgId,
  })
}

function useInvalidateOrganizations() {
  const qc = useQueryClient()
  return (orgId?: string) => {
    qc.invalidateQueries({ queryKey: queryKeys.organizations.all })
    if (orgId) qc.invalidateQueries({ queryKey: queryKeys.organizations.detail(orgId) })
  }
}

export function useCreateOrganization() {
  const invalidate = useInvalidateOrganizations()
  return useMutation({
    mutationFn: (body: { name: string; slug: string; logo?: string }) =>
      services.organization.create(body).then((r) => r.data),
    onSuccess: () => invalidate(),
  })
}

export function useUpdateOrganization(orgId: string) {
  const invalidate = useInvalidateOrganizations()
  return useMutation({
    mutationFn: (body: { name?: string; logo?: string }) =>
      services.organization.update(orgId, body).then((r) => r.data),
    onSuccess: () => invalidate(orgId),
  })
}

export function useDeleteOrganization() {
  const invalidate = useInvalidateOrganizations()
  return useMutation({
    mutationFn: (orgId: string) => services.organization.delete(orgId),
    onSuccess: () => invalidate(),
  })
}

// ── Members ────────────────────────────────────────────────────────────

export function useOrganizationMembers(orgId: string, params?: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.organizations.members(orgId, params),
    queryFn: () => services.organization.listMembers(orgId, params).then((r) => r.data),
    enabled: !!orgId,
  })
}

function useInvalidateMembers(orgId: string) {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['organizations', orgId, 'members'] })
}

export function useAddOrganizationMember(orgId: string) {
  const invalidate = useInvalidateMembers(orgId)
  return useMutation({
    mutationFn: (body: { user_id: string; role: string }) =>
      services.organization.addMember(orgId, body).then((r) => r.data),
    onSuccess: () => invalidate(),
  })
}

export function useUpdateOrganizationMemberRole(orgId: string) {
  const invalidate = useInvalidateMembers(orgId)
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      services.organization.updateMemberRole(orgId, userId, { role }).then((r) => r.data),
    onSuccess: () => invalidate(),
  })
}

export function useRemoveOrganizationMember(orgId: string) {
  const invalidate = useInvalidateMembers(orgId)
  return useMutation({
    mutationFn: (userId: string) => services.organization.removeMember(orgId, userId),
    onSuccess: () => invalidate(),
  })
}

// ── Invitations ────────────────────────────────────────────────────────

export function useOrganizationInvitations(orgId: string, params?: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.organizations.invitations(orgId, params),
    queryFn: () => services.organization.listInvitations(orgId, params).then((r) => r.data),
    enabled: !!orgId,
  })
}

function useInvalidateInvitations(orgId: string) {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['organizations', orgId, 'invitations'] })
}

export function useCreateInvitation(orgId: string) {
  const invalidate = useInvalidateInvitations(orgId)
  return useMutation({
    mutationFn: (body: { email: string; role?: string }) =>
      services.organization.createInvitation(orgId, body).then((r) => r.data),
    onSuccess: () => invalidate(),
  })
}

export function useUpdateInvitation(orgId: string) {
  const invalidate = useInvalidateInvitations(orgId)
  return useMutation({
    mutationFn: ({ invitationId, status }: { invitationId: string; status: string }) =>
      services.organization.updateInvitation(orgId, invitationId, { status }).then((r) => r.data),
    onSuccess: () => invalidate(),
  })
}

export function useDeleteInvitation(orgId: string) {
  const invalidate = useInvalidateInvitations(orgId)
  return useMutation({
    mutationFn: (invitationId: string) =>
      services.organization.deleteInvitation(orgId, invitationId),
    onSuccess: () => invalidate(),
  })
}

export type { Models }
