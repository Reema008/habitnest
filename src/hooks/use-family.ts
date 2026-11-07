import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createFamily, createInvitation, getMyFamily, joinFamily, leaveFamily, listInvitations, removeMember, renameFamily,
  revokeInvitation, setMemberRole,
} from '@/api/family'
import { getVisibleProfiles } from '@/api/profiles'
import { queryKeys } from '@/lib/query-keys'
import { useCurrentUser } from '@/providers/auth-provider'
import type { FamilyRole } from '@/types/models'

/** My family with members & profiles, or null when I am not in a family. */
export function useMyFamily() {
  const { userId } = useCurrentUser()
  return useQuery({ queryKey: queryKeys.family.mine, queryFn: () => getMyFamily(userId) })
}

/** Profiles I can see (me + my family). */
export function useVisibleProfiles() {
  return useQuery({ queryKey: queryKeys.profile.family, queryFn: getVisibleProfiles })
}

export function useInvitations(enabled = true) {
  return useQuery({ queryKey: queryKeys.family.invitations, queryFn: listInvitations, enabled })
}

function useInvalidateFamily() {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.family.all }),
      qc.invalidateQueries({ queryKey: queryKeys.profile.family }),
      qc.invalidateQueries({ queryKey: queryKeys.habits.shared }),
      qc.invalidateQueries({ queryKey: queryKeys.challenges.all }),
      qc.invalidateQueries({ queryKey: queryKeys.achievements.all }),
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all }),
    ])
}

export function useCreateFamily() {
  const invalidate = useInvalidateFamily()
  return useMutation({ mutationFn: (name: string) => createFamily(name), onSuccess: invalidate })
}

export function useJoinFamily() {
  const invalidate = useInvalidateFamily()
  return useMutation({ mutationFn: (code: string) => joinFamily(code), onSuccess: invalidate })
}

export function useLeaveFamily() {
  const invalidate = useInvalidateFamily()
  return useMutation({ mutationFn: leaveFamily, onSuccess: invalidate })
}

export function useRemoveMember() {
  const invalidate = useInvalidateFamily()
  return useMutation({ mutationFn: (userId: string) => removeMember(userId), onSuccess: invalidate })
}

export function useSetMemberRole() {
  const invalidate = useInvalidateFamily()
  return useMutation({ mutationFn: (v: { userId: string; role: FamilyRole }) => setMemberRole(v.userId, v.role), onSuccess: invalidate })
}

export function useRenameFamily() {
  const invalidate = useInvalidateFamily()
  return useMutation({ mutationFn: (v: { familyId: string; name: string }) => renameFamily(v.familyId, v.name), onSuccess: invalidate })
}

export function useCreateInvitation() {
  const invalidate = useInvalidateFamily()
  return useMutation({
    mutationFn: (v: { maxUses?: number; validDays?: number } = {}) => createInvitation(v.maxUses, v.validDays),
    onSuccess: invalidate,
  })
}

export function useRevokeInvitation() {
  const invalidate = useInvalidateFamily()
  return useMutation({ mutationFn: (id: string) => revokeInvitation(id), onSuccess: invalidate })
}
