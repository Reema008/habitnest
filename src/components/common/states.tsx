import { AlertCircle, RefreshCw } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toUserMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { GlassCard } from './glass-card'

/** Friendly empty state with an optional call to action. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <GlassCard className={cn('flex flex-col items-center gap-3 px-6 py-10 text-center', className)}>
      <div className="flex size-14 items-center justify-center rounded-full bg-lavender/60">
        <Icon className="size-7 text-primary" aria-hidden />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-bold">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </GlassCard>
  )
}

/** Error state with retry. Never shows raw technical errors. */
export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  return (
    <GlassCard role="alert" className={cn('flex flex-col items-center gap-3 px-6 py-8 text-center', className)}>
      <AlertCircle className="size-8 text-destructive" aria-hidden />
      <p className="text-sm">{toUserMessage(error)}</p>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          <RefreshCw className="size-4" /> Try again
        </Button>
      ) : null}
    </GlassCard>
  )
}

/** Skeleton placeholder list for loading screens. */
export function LoadingState({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)} aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-2xl bg-glass" />
      ))}
    </div>
  )
}

export function FullScreenLoader({ label = 'Loading HabitNest…' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4" aria-busy="true">
      <div className="size-12 animate-spin rounded-full border-4 border-lavender border-t-primary" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}
