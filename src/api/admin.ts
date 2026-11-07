/**
 * Family-admin actions that need elevated server privileges. They run in Supabase Edge Functions,
 * which verify the caller is an admin of the target member's family before doing anything.
 */
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { AppError } from '@/lib/errors'

type ResetResponse = { temporaryPassword?: unknown }

async function serverMessage(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.clone().json()
    if (body && typeof body === 'object') {
      const record = body as Record<string, unknown>
      const msg = record.error ?? record.message
      if (typeof msg === 'string' && msg.length > 0 && msg.length < 160) return msg
    }
  } catch {
    // Body was not JSON; fall back to the status-based message.
  }
  return null
}

/**
 * Creates a one-time temporary password for a family member. The member must choose a new
 * password the next time they sign in. Returns the temporary password (show it only once).
 */
export async function resetMemberPassword(userId: string): Promise<string> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new AppError('You are offline. Reset passwords once you reconnect.')
  }
  const { data, error } = await supabase.functions.invoke<ResetResponse>('admin-reset-password', { body: { userId } })

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const response: unknown = error.context
      const status = response instanceof Response ? response.status : 0
      const fromServer = response instanceof Response ? await serverMessage(response) : null
      switch (status) {
        case 401:
          throw new AppError('Your session expired. Please sign in again.')
        case 403:
          throw new AppError('Only family admins can reset passwords for members of their own family.')
        case 404:
          throw new AppError('Password reset isn’t set up on this server yet (the admin-reset-password function is not deployed).')
        case 429:
          throw new AppError('Too many password resets in a short time. Please wait a little and try again.')
        default:
          throw new AppError(fromServer ?? 'The password could not be reset right now. Please try again later.')
      }
    }
    if (error instanceof FunctionsRelayError || error instanceof FunctionsFetchError) {
      throw new AppError(
        'Could not reach the password reset service. Check your connection, or the function may not be deployed yet.',
      )
    }
    throw new AppError('The password could not be reset right now. Please try again later.')
  }

  const password = data?.temporaryPassword
  if (typeof password !== 'string' || password.length === 0) {
    throw new AppError('The server did not return a temporary password. Please try again.')
  }
  return password
}
