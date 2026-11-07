import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateMyProfile, uploadAvatar, type ProfileUpdate } from '@/api/profiles'
import { queryKeys } from '@/lib/query-keys'
import { useCurrentUser } from '@/providers/auth-provider'

function useInvalidateProfile() {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.profile.me }),
      qc.invalidateQueries({ queryKey: queryKeys.profile.family }),
    ])
}

/** Updates my profile (name, avatar, pet, …) and refreshes every cached copy of it. */
export function useUpdateProfile() {
  const { userId } = useCurrentUser()
  const invalidate = useInvalidateProfile()
  return useMutation({
    mutationFn: (patch: ProfileUpdate) => updateMyProfile(userId, patch),
    onSettled: invalidate,
  })
}

/** Uploads a photo (resized in the browser) and makes it my avatar. */
export function useUploadAvatar() {
  const { userId } = useCurrentUser()
  const invalidate = useInvalidateProfile()
  return useMutation({
    mutationFn: async (file: File) => {
      const url = await uploadAvatar(userId, file)
      return updateMyProfile(userId, { avatar_url: url })
    },
    onSettled: invalidate,
  })
}
