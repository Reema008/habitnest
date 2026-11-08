/** Available app themes. Colours live in ./themes.css (light + dark per theme). */
export const THEMES = [
  { id: 'aurora', name: 'Aurora', description: 'Calm frosted glass in cool lavender, blue and aqua.' },
  { id: 'midnight', name: 'Midnight', description: 'Sleek silver glass by day, deep navy with a cyan glow by night.' },
  { id: 'sage', name: 'Sage & Sand', description: 'Natural and grounded: sage, sand and cream with serif headings.' },
  { id: 'rose', name: 'Rose Quartz', description: 'Elegant blush, mauve and champagne tones.' },
  { id: 'mono', name: 'Mono', description: 'Minimal monochrome glass. Quiet and focused.' },
  { id: 'pastel', name: 'Pastel Dream', description: 'Playful candy pastels with floating bubbles.' },
] as const

export type ThemeName = (typeof THEMES)[number]['id']

export const DEFAULT_THEME: ThemeName = 'aurora'

export function isThemeName(v: unknown): v is ThemeName {
  return typeof v === 'string' && THEMES.some((t) => t.id === v)
}
