/**
 * admin-reset-password — a family admin resets another member's password.
 *
 * POST { userId } with the admin's access token in `Authorization: Bearer …`.
 * Checks: valid caller → valid target uuid → not self → caller is an admin of the target's
 * family → at most 5 resets per admin per hour. Then sets a random temporary password, flags
 * the profile so the member must choose a new one, notifies them and writes an audit row.
 * Returns { temporaryPassword } (shown once to the admin). Errors are { error } JSON.
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import { handlePreflight, jsonResponse } from '../_shared/cors.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_RESETS_PER_HOUR = 5
const PASSWORD_LENGTH = 12
// No look-alikes (0/O, 1/l/I).
const LOWER = 'abcdefghijkmnpqrstuvwxyz'
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const DIGITS = '23456789'
const ALPHABET = LOWER + UPPER + DIGITS

/** Uniformly random character from `alphabet` (rejection sampling avoids modulo bias). */
function randomChar(alphabet: string): string {
  const limit = 256 - (256 % alphabet.length)
  const buf = new Uint8Array(1)
  for (;;) {
    crypto.getRandomValues(buf)
    if (buf[0] < limit) return alphabet[buf[0] % alphabet.length]
  }
}

/** 12 characters containing at least one lowercase letter, uppercase letter and digit. */
function generatePassword(): string {
  for (;;) {
    let out = ''
    for (let i = 0; i < PASSWORD_LENGTH; i += 1) out += randomChar(ALPHABET)
    if (/[a-z]/.test(out) && /[A-Z]/.test(out) && /[2-9]/.test(out)) return out
  }
}

function bearerToken(req: Request): string | null {
  const header = req.headers.get('Authorization') ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match ? match[1].trim() : null
}

async function readUserId(req: Request): Promise<string | null> {
  try {
    const body: unknown = await req.json()
    if (body && typeof body === 'object' && 'userId' in body) {
      const id = (body as { userId: unknown }).userId
      return typeof id === 'string' ? id : null
    }
    return null
  } catch {
    return null
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  const preflight = handlePreflight(req)
  if (preflight) return preflight
  if (req.method !== 'POST') return jsonResponse(req, { error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return jsonResponse(req, { error: 'Server is not configured' }, 500)

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  // 1. Who is calling?
  const token = bearerToken(req)
  if (!token) return jsonResponse(req, { error: 'Please sign in again.' }, 401)
  const { data: userData, error: userError } = await admin.auth.getUser(token)
  const caller = userData?.user
  if (userError || !caller) return jsonResponse(req, { error: 'Please sign in again.' }, 401)

  // 2. Whose password?
  const targetId = await readUserId(req)
  if (!targetId || !UUID.test(targetId)) return jsonResponse(req, { error: 'Choose a family member.' }, 400)
  if (targetId === caller.id) {
    return jsonResponse(req, { error: 'To change your own password, use Settings → Security.' }, 400)
  }

  // 3. Caller must be an admin of the target's family.
  const { data: memberships, error: membersError } = await admin
    .from('family_members')
    .select('user_id, family_id, role')
    .in('user_id', [caller.id, targetId])
  if (membersError) return jsonResponse(req, { error: 'Something went wrong. Please try again.' }, 500)
  const callerMembership = memberships?.find((m) => m.user_id === caller.id)
  const targetMembership = memberships?.find((m) => m.user_id === targetId)
  if (
    !callerMembership ||
    !targetMembership ||
    callerMembership.family_id !== targetMembership.family_id ||
    callerMembership.role !== 'admin'
  ) {
    return jsonResponse(req, { error: "Only a family admin can reset a family member's password." }, 403)
  }
  const familyId: string = targetMembership.family_id

  // 4. Rate limit.
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count, error: countError } = await admin
    .from('admin_password_resets')
    .select('id', { count: 'exact', head: true })
    .eq('admin_id', caller.id)
    .gte('created_at', since)
  if (countError) return jsonResponse(req, { error: 'Something went wrong. Please try again.' }, 500)
  if ((count ?? 0) >= MAX_RESETS_PER_HOUR) {
    return jsonResponse(req, { error: 'Too many password resets. Please wait an hour and try again.' }, 429)
  }

  // 5. Audit first, so every attempt that reaches this point counts towards the limit.
  const { error: auditError } = await admin
    .from('admin_password_resets')
    .insert({ admin_id: caller.id, target_id: targetId, family_id: familyId })
  if (auditError) return jsonResponse(req, { error: 'Something went wrong. Please try again.' }, 500)

  // 6. Reset.
  const temporaryPassword = generatePassword()
  const { error: updateError } = await admin.auth.admin.updateUserById(targetId, { password: temporaryPassword })
  if (updateError) {
    console.error('admin-reset-password: password update failed', updateError.status ?? '')
    return jsonResponse(req, { error: 'The password could not be reset. Please try again.' }, 500)
  }

  const { error: flagError } = await admin.from('profiles').update({ must_change_password: true }).eq('id', targetId)
  if (flagError) console.error('admin-reset-password: could not flag profile', flagError.code ?? '')

  const { error: notifyError } = await admin.from('notifications').insert({
    user_id: targetId,
    kind: 'password_reset',
    title: 'Your password was reset',
    body: "A family admin reset your password. You'll be asked to choose a new one.",
    data: { by: caller.id },
  })
  if (notifyError) console.error('admin-reset-password: could not notify member', notifyError.code ?? '')

  return jsonResponse(req, { temporaryPassword })
})
