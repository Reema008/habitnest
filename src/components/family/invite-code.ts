/** Invite codes are 10 characters from an unambiguous alphabet (no I, O, 0 or 1). */
export const INVITE_CODE_LENGTH = 10
const INVITE_CODE_RE = /^[A-HJ-NP-Z2-9]{10}$/

/** Uppercases and strips anything that cannot be part of a code (spaces, dashes, …). */
export function normalizeInviteCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, INVITE_CODE_LENGTH)
}

export function isInviteCode(code: string): boolean {
  return INVITE_CODE_RE.test(code)
}
