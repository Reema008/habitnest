import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import type { ISODate } from '@/lib/dates'
import {
  canGoNext, isCurrentPeriod, PERIOD_NOUN, periodRange, periodTitle, rangeLabel, shiftPeriod, type PeriodKind,
} from './period'

/** Previous / next period buttons with the current period's name and a "This week" shortcut. */
export function PeriodNavigator({
  kind,
  anchor,
  today,
  onChange,
  className,
}: {
  kind: PeriodKind
  anchor: ISODate
  today: ISODate
  onChange: (anchor: ISODate) => void
  className?: string
}) {
  const noun = PERIOD_NOUN[kind]
  const current = isCurrentPeriod(kind, anchor, today)
  const range = periodRange(kind, anchor)
  return (
    <div className={cn('glass flex items-center gap-1 rounded-2xl p-1', className)}>
      <Button
        variant="ghost"
        size="icon"
        className="size-11 rounded-xl"
        aria-label={`Previous ${noun}`}
        onClick={() => onChange(shiftPeriod(kind, anchor, -1))}
      >
        <ChevronLeft className="size-5" />
      </Button>
      <div className="min-w-0 flex-1 text-center" aria-live="polite">
        <p className="truncate font-bold leading-tight">{periodTitle(kind, anchor, today)}</p>
        {kind !== 'day' ? <p className="truncate text-xs text-muted-foreground">{rangeLabel(range)}</p> : null}
      </div>
      {!current ? (
        <Button variant="secondary" className="h-11 rounded-xl px-3" onClick={() => onChange(today)}>
          {kind === 'day' ? 'Today' : `This ${noun}`}
        </Button>
      ) : null}
      <Button
        variant="ghost"
        size="icon"
        className="size-11 rounded-xl"
        aria-label={`Next ${noun}`}
        disabled={!canGoNext(kind, anchor, today)}
        onClick={() => onChange(shiftPeriod(kind, anchor, 1))}
      >
        <ChevronRight className="size-5" />
      </Button>
    </div>
  )
}

/** Segmented control for choosing the period length. */
export function PeriodKindToggle({
  value,
  options,
  onChange,
  label = 'Period',
  className,
}: {
  value: PeriodKind
  options: readonly PeriodKind[]
  onChange: (kind: PeriodKind) => void
  label?: string
  className?: string
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => {
        const next = options.find((o) => o === v)
        if (next) onChange(next)
      }}
      aria-label={label}
      spacing={0}
      className={cn('glass w-full rounded-2xl p-1', className)}
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o}
          value={o}
          className="h-11 flex-1 rounded-xl capitalize data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          {o}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
