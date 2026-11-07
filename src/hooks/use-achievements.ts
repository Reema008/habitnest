import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listAchievementCatalogue, listUserAchievements } from '@/api/achievements'
import { queryKeys } from '@/lib/query-keys'
import type { Achievement, UserAchievement } from '@/types/models'

export function useAchievementCatalogue() {
  return useQuery({ queryKey: queryKeys.achievements.catalogue, queryFn: listAchievementCatalogue, staleTime: 1000 * 60 * 60 })
}

export type EarnedBadge = UserAchievement & { achievement: Achievement }

/** Badges earned by a user, joined with the catalogue. */
export function useUserBadges(userId: string | undefined) {
  const catalogue = useAchievementCatalogue()
  const earned = useQuery({
    queryKey: queryKeys.achievements.forUser(userId ?? ''),
    queryFn: () => listUserAchievements(userId!),
    enabled: !!userId,
  })
  const data = useMemo<EarnedBadge[] | undefined>(() => {
    if (!earned.data || !catalogue.data) return undefined
    const byId = new Map(catalogue.data.map((a) => [a.id, a]))
    return earned.data.filter((e) => byId.has(e.achievement_id)).map((e) => ({ ...e, achievement: byId.get(e.achievement_id)! }))
  }, [earned.data, catalogue.data])
  return {
    data,
    catalogue: catalogue.data,
    isPending: earned.isPending || catalogue.isPending,
    error: earned.error ?? catalogue.error,
    refetch: () => {
      void earned.refetch()
      void catalogue.refetch()
    },
  }
}
