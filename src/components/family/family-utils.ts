import { formatDay } from '@/lib/dates'
import type { FamilyChallenge } from '@/types/models'

/** Copies text to the clipboard; resolves false when the browser refuses. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard) return false
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** Date range like "10 Nov – 16 Nov 2026". */
export function formatChallengeDates(c: Pick<FamilyChallenge, 'start_date' | 'end_date'>): string {
  const sameYear = c.start_date.slice(0, 4) === c.end_date.slice(0, 4)
  return `${formatDay(c.start_date, sameYear ? 'd MMM' : 'd MMM yyyy')} – ${formatDay(c.end_date, 'd MMM yyyy')}`
}
