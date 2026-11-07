import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { Award } from 'lucide-react'
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { HabitIcon } from '@/components/common/habit-visuals'
import { EmptyState, ErrorState } from '@/components/common/states'
import { useUserBadges } from '@/hooks/use-achievements'
import { cn } from '@/lib/utils'

/** Every badge in the catalogue: earned ones shine, the rest wait softly ("Not yet"). Badges are never lost. */
export function BadgesGrid({ userId }: { userId: string }) {
  const { data: earned, catalogue, isPending, error, refetch } = useUserBadges(userId)

  const earnedById = useMemo(() => new Map((earned ?? []).map((b) => [b.achievement_id, b])), [earned])

  if (isPending) {
    return (
      <div className="grid grid-cols-3 gap-2" aria-busy="true">
        <span className="sr-only">Loading badges…</span>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl bg-glass" />
        ))}
      </div>
    )
  }
  if (error) return <ErrorState error={error} onRetry={refetch} />
  if (!catalogue || catalogue.length === 0) {
    return <EmptyState icon={Award} title="Badges are on their way" description="Check back soon for things to celebrate." />
  }

  const earnedCount = catalogue.filter((a) => earnedById.has(a.id)).length

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {earnedCount === 0
          ? 'Your first badge is just around the corner.'
          : `${earnedCount} of ${catalogue.length} earned — they're yours to keep.`}
      </p>
      <ul className="grid grid-cols-3 gap-2">
        {catalogue.map((a) => {
          const badge = earnedById.get(a.id)
          const earnedOn = badge ? format(parseISO(badge.earned_at), 'd MMM yyyy') : null
          return (
            <li key={a.id}>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label={`${a.name}: ${earnedOn ? `earned ${earnedOn}` : 'not yet earned'}`}
                    className={cn(
                      'glass flex h-full min-h-28 w-full flex-col items-center justify-start gap-1.5 rounded-2xl px-1.5 py-3 text-center outline-none transition',
                      'focus-visible:ring-3 focus-visible:ring-ring/60',
                      !badge && 'opacity-60',
                    )}
                  >
                    <HabitIcon
                      icon={a.icon}
                      color={badge ? 'lemon' : 'lavender'}
                      className={cn('size-11 rounded-full', !badge && 'bg-muted')}
                      iconClassName={cn(!badge && 'text-muted-foreground')}
                    />
                    <span className="text-xs font-bold leading-tight">{a.name}</span>
                    <span className={cn('text-[0.7rem] font-semibold', badge ? 'text-success' : 'text-muted-foreground')}>
                      {badge ? 'Earned' : 'Not yet'}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 rounded-2xl">
                  <PopoverHeader>
                    <PopoverTitle className="font-extrabold">{a.name}</PopoverTitle>
                    <PopoverDescription>{a.description}</PopoverDescription>
                  </PopoverHeader>
                  <p className="mt-2 text-sm font-semibold">
                    {earnedOn ? `Earned on ${earnedOn}` : 'Not yet — you’ll get there in your own time.'}
                  </p>
                </PopoverContent>
              </Popover>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
