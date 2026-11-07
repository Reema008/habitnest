import { createElement, isValidElement } from 'react'
import type { LucideIcon } from 'lucide-react'
import { GlassCard } from '@/components/common/glass-card'
import { cn } from '@/lib/utils'

const TONES = {
  lavender: 'bg-lavender',
  peach: 'bg-peach',
  mint: 'bg-mint',
  sky: 'bg-sky',
  rose: 'bg-rose',
  lemon: 'bg-lemon',
} as const

/** Compact stat tile: label, big value and an optional hint. */
export function SummaryCard({
  label,
  value,
  hint,
  icon,
  tone = 'lavender',
  className,
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  /** A lucide icon component (e.g. `Flame`) or a ready element. */
  icon?: LucideIcon | React.ReactElement
  tone?: keyof typeof TONES
  className?: string
}) {
  const iconNode = isValidElement(icon)
    ? icon
    : icon
      ? createElement(icon, { className: 'size-4 text-foreground/80', 'aria-hidden': true })
      : null
  return (
    <GlassCard className={cn('flex min-w-0 flex-col gap-1 p-3', className)}>
      <div className="flex items-center gap-2">
        {iconNode ? (
          <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-lg', TONES[tone])}>{iconNode}</span>
        ) : null}
        <p className="min-w-0 truncate text-xs font-semibold text-muted-foreground">{label}</p>
      </div>
      <p className="text-2xl font-extrabold tabular-nums leading-tight">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </GlassCard>
  )
}
