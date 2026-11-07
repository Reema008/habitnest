import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  changeChallengeHabit, createChallenge, deleteChallenge, getChallenge, getChallengeProgress, joinChallenge, leaveChallenge,
  listChallenges, listMyParticipations, listParticipants, updateChallenge, type ChallengeProgress, type ChallengeUpdate,
  type JoinChallengeInput, type NewChallenge,
} from '@/api/challenges'
import { queryKeys } from '@/lib/query-keys'
import { useCurrentUser } from '@/providers/auth-provider'

/** All challenges of my family (RLS returns none when I am not in a family). */
export function useChallenges(enabled = true) {
  return useQuery({ queryKey: queryKeys.challenges.list, queryFn: listChallenges, enabled })
}

export function useChallenge(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.challenges.detail(id ?? ''),
    queryFn: () => getChallenge(id!),
    enabled: !!id,
  })
}

/** Participants (with linked habit ids) of one challenge. */
export function useChallengeParticipants(id: string | undefined) {
  return useQuery({
    queryKey: [...queryKeys.challenges.detail(id ?? ''), 'participants'],
    queryFn: () => listParticipants(id!),
    enabled: !!id,
  })
}

/** My participations in all family challenges. */
export function useMyChallengeParticipations(enabled = true) {
  const { userId } = useCurrentUser()
  return useQuery({
    queryKey: [...queryKeys.challenges.all, 'mine', userId],
    queryFn: () => listMyParticipations(userId),
    enabled,
  })
}

export function useChallengeProgress(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.challenges.progress(id ?? ''),
    queryFn: () => getChallengeProgress(id!),
    enabled: !!id,
  })
}

/** Progress for several challenges at once, keyed by challenge id. */
export function useChallengeProgressMany(ids: string[]) {
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: queryKeys.challenges.progress(id),
      queryFn: () => getChallengeProgress(id),
    })),
    combine: (results) => {
      const data: Record<string, ChallengeProgress[]> = {}
      results.forEach((r, i) => {
        const id = ids[i]
        if (id && r.data) data[id] = r.data
      })
      return { data, isPending: results.some((r) => r.isPending), isError: results.some((r) => r.isError) }
    },
  })
}

function useInvalidateChallenges() {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.challenges.all }),
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all }),
    ])
}

export function useCreateChallenge() {
  const invalidate = useInvalidateChallenges()
  return useMutation({ mutationFn: (input: NewChallenge) => createChallenge(input), onSuccess: invalidate })
}

export function useUpdateChallenge() {
  const invalidate = useInvalidateChallenges()
  return useMutation({
    mutationFn: (v: { id: string; patch: ChallengeUpdate }) => updateChallenge(v.id, v.patch),
    onSuccess: invalidate,
  })
}

export function useDeleteChallenge() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteChallenge(id),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: queryKeys.challenges.detail(id) })
      qc.removeQueries({ queryKey: queryKeys.challenges.progress(id) })
      return Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.challenges.all }),
        qc.invalidateQueries({ queryKey: queryKeys.notifications.all }),
      ])
    },
  })
}

export function useJoinChallenge() {
  const invalidate = useInvalidateChallenges()
  return useMutation({ mutationFn: (input: JoinChallengeInput) => joinChallenge(input), onSuccess: invalidate })
}

export function useChangeChallengeHabit() {
  const invalidate = useInvalidateChallenges()
  return useMutation({
    mutationFn: (v: { participantId: string; habitId: string; fieldKey: string | null }) =>
      changeChallengeHabit(v.participantId, v.habitId, v.fieldKey),
    onSuccess: invalidate,
  })
}

export function useLeaveChallenge() {
  const invalidate = useInvalidateChallenges()
  return useMutation({ mutationFn: (participantId: string) => leaveChallenge(participantId), onSuccess: invalidate })
}
