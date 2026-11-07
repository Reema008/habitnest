import {
  Apple, Bed, Bike, BookOpen, Brain, CalendarCheck, Coffee, Cookie, Dumbbell, Flame, FlameKindling, Footprints,
  GlassWater, Heart, HouseHeart, Languages, Leaf, Medal, Moon, Music, Palette, Pencil, Pill, Smile, Sparkles,
  Sprout, Star, Sun, Timer, Trophy, WandSparkles,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { HabitColor } from '@/types/models'

/** Icons a habit (or badge) may use. Keys match habits.icon / achievements.icon. */
export const HABIT_ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles, moon: Moon, dumbbell: Dumbbell, footprints: Footprints, cookie: Cookie,
  'glass-water': GlassWater, 'book-open': BookOpen, brain: Brain, heart: Heart, apple: Apple, bike: Bike,
  music: Music, pencil: Pencil, sun: Sun, coffee: Coffee, pill: Pill, leaf: Leaf, smile: Smile, bed: Bed,
  timer: Timer, languages: Languages, palette: Palette,
  // badge icons
  sprout: Sprout, flame: Flame, 'flame-kindling': FlameKindling, trophy: Trophy, star: Star, medal: Medal,
  'calendar-check': CalendarCheck, 'wand-sparkles': WandSparkles, 'house-heart': HouseHeart,
}

/** Icons offered in the habit builder. */
export const SELECTABLE_HABIT_ICONS = [
  'sparkles', 'moon', 'dumbbell', 'footprints', 'cookie', 'glass-water', 'book-open', 'brain', 'heart', 'apple',
  'bike', 'music', 'pencil', 'sun', 'coffee', 'pill', 'leaf', 'smile', 'bed', 'timer', 'languages', 'palette',
] as const

/** Tailwind classes for each pastel habit colour. */
export const HABIT_COLOR_CLASSES: Record<HabitColor, { bg: string; soft: string; text: string }> = {
  lavender: { bg: 'bg-lavender', soft: 'bg-lavender/40', text: 'text-lavender' },
  peach: { bg: 'bg-peach', soft: 'bg-peach/40', text: 'text-peach' },
  mint: { bg: 'bg-mint', soft: 'bg-mint/40', text: 'text-mint' },
  sky: { bg: 'bg-sky', soft: 'bg-sky/40', text: 'text-sky' },
  rose: { bg: 'bg-rose', soft: 'bg-rose/40', text: 'text-rose' },
  lemon: { bg: 'bg-lemon', soft: 'bg-lemon/40', text: 'text-lemon' },
}

export function habitColor(color: string | null | undefined) {
  return HABIT_COLOR_CLASSES[(color as HabitColor) in HABIT_COLOR_CLASSES ? (color as HabitColor) : 'lavender']
}

/** Rounded coloured tile with the habit's icon. */
export function HabitIcon({
  icon,
  color,
  className,
  iconClassName,
}: {
  icon: string | null | undefined
  color?: string | null
  className?: string
  iconClassName?: string
}) {
  const Icon = HABIT_ICONS[icon ?? ''] ?? Sparkles
  return (
    <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', habitColor(color).bg, className)}>
      <Icon className={cn('size-5 text-foreground/80', iconClassName)} aria-hidden />
    </span>
  )
}
