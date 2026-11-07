/**
 * Family membership & invitations. All writes go through SECURITY DEFINER RPCs that validate
 * roles server-side; reads are limited by RLS to the caller's own family.
 */
import { supabase } from '@/lib/supabase'
import { unwrap, unwrapMaybe } from '@/lib/errors'
import type { Family, FamilyInvitation, FamilyMemberWithProfile, FamilyRole, Profile } from '@/types/models'

export type MyFamily = {
  family: Family
  members: FamilyMemberWithProfile[]
  myRole: FamilyRole
}

export async function getMyFamily(userId: string): Promise<MyFamily | null> {
  const membership = unwrapMaybe(await supabase.from('family_members').select('*').eq('user_id', userId).maybeSingle())
  if (!membership) return null
  const [family, members, profiles] = await Promise.all([
    supabase.from('families').select('*').eq('id', membership.family_id).single().then(unwrap),
    supabase.from('family_members').select('*').eq('family_id', membership.family_id).order('joined_at').then(unwrap),
    supabase.from('profiles').select('*').then(unwrap),
  ])
  const byId = new Map<string, Profile>(profiles.map((p) => [p.id, p]))
  return {
    family,
    myRole: membership.role,
    members: members
      .filter((m) => byId.has(m.user_id))
      .map((m) => ({ ...m, profile: byId.get(m.user_id)! })),
  }
}

export async function createFamily(name: string): Promise<string> {
  return unwrap(await supabase.rpc('create_family', { p_name: name.trim() }))
}

/** Returns the joined family id, or null when the code is invalid/expired/used up. */
export async function joinFamily(code: string): Promise<string | null> {
  return unwrapMaybe(await supabase.rpc('join_family', { p_code: code.trim().toUpperCase() }))
}

export async function previewInvitation(code: string): Promise<{ familyName: string; memberCount: number } | null> {
  const rows = unwrap(await supabase.rpc('preview_invitation', { p_code: code.trim().toUpperCase() }))
  const r = rows?.[0]
  return r ? { familyName: r.family_name ?? 'A family', memberCount: r.member_count ?? 0 } : null
}

export async function leaveFamily(): Promise<void> {
  unwrap(await supabase.rpc('leave_family'))
}

export async function removeMember(userId: string): Promise<void> {
  unwrap(await supabase.rpc('remove_family_member', { p_user: userId }))
}

export async function setMemberRole(userId: string, role: FamilyRole): Promise<void> {
  unwrap(await supabase.rpc('set_family_member_role', { p_user: userId, p_role: role }))
}

export async function renameFamily(familyId: string, name: string): Promise<void> {
  unwrap(await supabase.from('families').update({ name: name.trim() }).eq('id', familyId))
}

export async function listInvitations(): Promise<FamilyInvitation[]> {
  return unwrap(await supabase.from('family_invitations').select('*').order('created_at', { ascending: false }))
}

export async function createInvitation(maxUses = 10, validDays = 7) {
  const rows = unwrap(await supabase.rpc('create_invitation', { p_max_uses: maxUses, p_valid_days: validDays }))
  return rows[0]!
}

export async function revokeInvitation(id: string): Promise<void> {
  unwrap(await supabase.from('family_invitations').update({ revoked_at: new Date().toISOString() }).eq('id', id))
}

/** Absolute invite link (works with the GitHub Pages base path). */
export function inviteLink(code: string): string {
  return new URL(`${import.meta.env.BASE_URL}family/join/${code}`, window.location.origin).toString()
}
