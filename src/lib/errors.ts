/**
 * Turns Supabase/PostgREST/network errors into short, friendly messages for toasts and forms.
 * Database validation errors raised by our triggers/RPCs already carry human-readable text.
 */
type ErrorLike = { message?: string; code?: string; status?: number; name?: string } | null | undefined

export class AppError extends Error {
  readonly code?: string
  constructor(message: string, code?: string) {
    super(message)
    this.name = 'AppError'
    this.code = code
  }
}

export function toUserMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!error) return fallback
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'You are offline. Changes can be made once you reconnect.'
  }
  const e = error as ErrorLike
  const msg = e?.message ?? (typeof error === 'string' ? error : '')
  if (!msg) return fallback
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return 'Could not reach the server. Check your connection.'
  if (/Invalid login credentials/i.test(msg)) return 'Username or password is incorrect.'
  if (/User already registered/i.test(msg)) return 'That username is already taken.'
  if (/JWT|session.*(missing|expired)|refresh token/i.test(msg)) return 'Your session expired. Please sign in again.'
  if (/permission denied|row-level security/i.test(msg)) return 'You do not have permission to do that.'
  if (/duplicate key value/i.test(msg)) return 'That already exists.'
  // Messages raised by our own SQL (RAISE EXCEPTION) are written for users.
  if (msg.length < 160 && !/^(PGRST|42|23)\d/.test(e?.code ?? '')) return msg
  return fallback
}

/** Throws a typed error when a Supabase call returned one; returns data otherwise. */
export function unwrap<T>(result: { data: T | null; error: ErrorLike }): T {
  if (result.error) throw new AppError(result.error.message ?? 'Request failed', result.error.code)
  // A null result without an error is legitimate for some RPCs (e.g. join_family on a bad code).
  return result.data as T
}
