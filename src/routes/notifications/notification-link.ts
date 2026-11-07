import type { AppNotification, Json } from '@/types/models'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ACHIEVEMENT_CODE = /^[a-z0-9_-]{1,64}$/i

function field(data: Json, key: string): string | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const value = (data as Record<string, Json | undefined>)[key]
  return typeof value === 'string' ? value : null
}

/** In-app destination for a notification, or null when it has nowhere to go. */
export function notificationLink(n: Pick<AppNotification, 'kind' | 'data'>): string | null {
  const challengeId = field(n.data, 'challenge_id')
  if (challengeId && UUID.test(challengeId)) return `/family/challenges/${challengeId}`
  const achievement = field(n.data, 'achievement_code')
  if (achievement && ACHIEVEMENT_CODE.test(achievement)) return '/profile'
  if (n.kind === 'member_joined') return '/family'
  if (n.kind === 'password_reset') return '/settings#security'
  return null
}
