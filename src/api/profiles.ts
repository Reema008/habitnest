import { supabase } from '@/lib/supabase'
import { AppError, unwrap } from '@/lib/errors'
import type { Profile } from '@/types/models'
import type { TablesUpdate } from '@/types/database'

export async function getMyProfile(userId: string): Promise<Profile> {
  return unwrap(await supabase.from('profiles').select('*').eq('id', userId).single())
}

/** Profiles RLS returns: me + members of my family. */
export async function getVisibleProfiles(): Promise<Profile[]> {
  return unwrap(await supabase.from('profiles').select('*').order('display_name'))
}

export type ProfileUpdate = Pick<
  TablesUpdate<'profiles'>,
  'display_name' | 'avatar_url' | 'avatar_preset' | 'pet_type' | 'timezone' | 'onboarded_at'
>

export async function updateMyProfile(userId: string, patch: ProfileUpdate): Promise<Profile> {
  return unwrap(await supabase.from('profiles').update(patch).eq('id', userId).select('*').single())
}

const AVATAR_MAX_BYTES = 2 * 1024 * 1024

/** Resizes to max 512px (JPEG) in the browser, uploads to avatars/<uid>/, returns the public URL. */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new AppError('Please choose a JPEG, PNG or WebP image.')
  const blob = await resizeImage(file, 512)
  if (blob.size > AVATAR_MAX_BYTES) throw new AppError('That image is too large. Please choose a smaller one.')
  const path = `${userId}/avatar-${Date.now()}.jpg`
  const { error } = await supabase.storage.from('avatars').upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: true,
    cacheControl: '3600',
  })
  if (error) throw new AppError(error.message)
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  // Clean up older avatars in the user's folder (best effort).
  const { data: files } = await supabase.storage.from('avatars').list(userId)
  const stale = (files ?? []).map((f) => `${userId}/${f.name}`).filter((p) => p !== path)
  if (stale.length) await supabase.storage.from('avatars').remove(stale)
  return data.publicUrl
}

async function resizeImage(file: File, maxSize: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new AppError('Could not process the image.')
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new AppError('Could not process the image.'))), 'image/jpeg', 0.85),
  )
}
