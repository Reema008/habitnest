/**
 * Authentication data access. Members sign in with a *username*; it is mapped to an internal,
 * non-deliverable Supabase Auth address so no email is ever sent or shown.
 */
import { supabase } from '@/lib/supabase'
import { env } from '@/lib/env'
import { AppError, unwrap } from '@/lib/errors'
import { deviceTimeZone } from '@/lib/dates'

export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/
export const PASSWORD_MIN_LENGTH = 8

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase()
}

export function usernameToAuthEmail(username: string): string {
  return `${normalizeUsername(username)}@${env.authEmailDomain}`
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const name = normalizeUsername(username)
  if (!USERNAME_PATTERN.test(name)) return false
  return unwrap(await supabase.rpc('username_available', { p_username: name }))
}

export async function signUp(input: { username: string; password: string; displayName: string }) {
  const username = normalizeUsername(input.username)
  if (!USERNAME_PATTERN.test(username)) {
    throw new AppError('Usernames use 3–20 lowercase letters, numbers or underscores.')
  }
  const { data, error } = await supabase.auth.signUp({
    email: usernameToAuthEmail(username),
    password: input.password,
    options: {
      data: { username, display_name: input.displayName.trim(), timezone: deviceTimeZone() },
    },
  })
  if (error) throw new AppError(error.message, error.code)
  if (!data.session) {
    // Happens only if "Confirm email" is turned on in Supabase — it must be off for HabitNest.
    throw new AppError('Sign-up needs "Confirm email" turned off in Supabase Auth settings.')
  }
  return data
}

export async function signIn(username: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: usernameToAuthEmail(username),
    password,
  })
  if (error) throw new AppError(error.message, error.code)
  return data
}

/** Fingerprint / Face ID sign-in using a passkey registered earlier in Settings. */
export async function signInWithPasskey() {
  const { data, error } = await supabase.auth.signInWithPasskey()
  if (error) throw new AppError(passkeyMessage(error), 'code' in error ? String(error.code) : undefined)
  return data
}

export async function registerPasskey() {
  const { data, error } = await supabase.auth.registerPasskey()
  if (error) throw new AppError(passkeyMessage(error))
  return data
}

export async function listPasskeys() {
  const { data, error } = await supabase.auth.passkey.list()
  if (error) throw new AppError(error.message)
  return data ?? []
}

export async function renamePasskey(passkeyId: string, friendlyName: string) {
  const { error } = await supabase.auth.passkey.update({ passkeyId, friendlyName })
  if (error) throw new AppError(error.message)
}

export async function deletePasskey(passkeyId: string) {
  const { error } = await supabase.auth.passkey.delete({ passkeyId })
  if (error) throw new AppError(error.message)
}

export function passkeysSupported(): boolean {
  return typeof window !== 'undefined' && 'PublicKeyCredential' in window && window.isSecureContext
}

function passkeyMessage(error: { message?: string; name?: string }): string {
  const msg = error.message ?? ''
  if (/NotAllowed|cancel|abort/i.test(`${error.name} ${msg}`)) return 'Fingerprint sign-in was cancelled.'
  if (/not enabled|passkey.*disabled|feature/i.test(msg)) {
    return 'Fingerprint sign-in is not enabled yet. Ask the app owner to turn on Passkeys in Supabase.'
  }
  return msg || 'Fingerprint sign-in failed. Please try again.'
}

export async function changePassword(newPassword: string) {
  if (newPassword.length < PASSWORD_MIN_LENGTH) {
    throw new AppError(`Use at least ${PASSWORD_MIN_LENGTH} characters.`)
  }
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw new AppError(error.message, error.code)
  unwrap(await supabase.rpc('ack_password_changed'))
}

export async function signOut() {
  await supabase.auth.signOut()
}
