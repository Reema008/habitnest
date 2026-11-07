import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getMySettings, updateMySettings, type SettingsUpdate } from '@/api/settings'
import { deletePasskey, listPasskeys, registerPasskey, renamePasskey } from '@/api/auth'
import { updateMyProfile } from '@/api/profiles'
import { AppError } from '@/lib/errors'
import { queryKeys } from '@/lib/query-keys'
import { useAuth } from '@/providers/auth-provider'
import type { UserSettings } from '@/types/models'

function settingsKey(userId: string | null) {
  return [...queryKeys.settings.me, userId] as const
}

/** The signed-in user's settings row (theme + reminders). Disabled while signed out. */
export function useSettings() {
  const { userId } = useAuth()
  return useQuery({
    queryKey: settingsKey(userId),
    queryFn: () => getMySettings(userId!),
    enabled: !!userId,
  })
}

/** Updates settings optimistically; rolls back and rethrows on failure. */
export function useUpdateSettings() {
  const { userId } = useAuth()
  const qc = useQueryClient()
  const key = settingsKey(userId)
  return useMutation({
    mutationFn: (patch: SettingsUpdate) => {
      if (!userId) throw new AppError('Please sign in again.')
      return updateMySettings(userId, patch)
    },
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<UserSettings>(key)
      if (previous) qc.setQueryData<UserSettings>(key, { ...previous, ...patch } as UserSettings)
      return { previous }
    },
    onError: (_e, _patch, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous)
    },
    onSuccess: (row) => qc.setQueryData(key, row),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.settings.me }),
  })
}

/** Sets the profile time zone used for reminders. */
export function useUpdateTimeZone() {
  const { userId } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (timezone: string) => {
      if (!userId) throw new AppError('Please sign in again.')
      return updateMyProfile(userId, { timezone })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.profile.me }),
  })
}

// --- Passkeys (fingerprint / Face ID sign-in) ---------------------------------------------------

export function usePasskeys(enabled = true) {
  return useQuery({ queryKey: queryKeys.passkeys.all, queryFn: listPasskeys, enabled, retry: false })
}

export function useRegisterPasskey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: registerPasskey,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.passkeys.all }),
  })
}

export function useRenamePasskey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; name: string }) => renamePasskey(v.id, v.name.trim()),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.passkeys.all }),
  })
}

export function useDeletePasskey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deletePasskey(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.passkeys.all }),
  })
}
