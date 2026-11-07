import { Copy, Layers, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import {
  durationMinutes, formatDuration, formatTime, formatTimeLabel, isActiveAt, nowMarkerIndex,
} from '@/domain/schedule'
import type { ScheduleItem } from '@/types/models'

type Props = {
  /** Items for one day, already sorted. */
  items: ScheduleItem[]
  overlaps: Set<string>
  /** Minutes since midnight when the day shown is today; null otherwise. */
  nowMinutes: number | null
  canWrite: boolean
  onEdit: (item: ScheduleItem) => void
  onCopy: (item: ScheduleItem) => void
  onDelete: (item: ScheduleItem) => void
}

/** A day's plan as a vertical timeline with a gentle "now" indicator and overlap hints. */
export function ScheduleTimeline({ items, overlaps, nowMinutes, canWrite, onEdit, onCopy, onDelete }: Props) {
  const markerAt = nowMinutes === null ? null : nowMarkerIndex(items, nowMinutes)

  const rows: React.ReactNode[] = []
  items.forEach((item, index) => {
    if (markerAt === index) rows.push(<NowMarker key="now" minutes={nowMinutes!} />)
    rows.push(
      <TimelineItem
        key={item.id}
        item={item}
        overlapping={overlaps.has(item.id)}
        active={nowMinutes !== null && isActiveAt(item, nowMinutes)}
        canWrite={canWrite}
        onEdit={onEdit}
        onCopy={onCopy}
        onDelete={onDelete}
      />,
    )
  })
  if (markerAt === items.length && nowMinutes !== null) rows.push(<NowMarker key="now" minutes={nowMinutes} />)

  return <ol className="relative space-y-2 before:absolute before:bottom-3 before:left-[calc(4.625rem-1px)] before:top-3 before:w-0.5 before:rounded-full before:bg-lavender/70">{rows}</ol>
}

function NowMarker({ minutes }: { minutes: number }) {
  return (
    <li className="relative flex items-center gap-3 py-1" aria-label={`Now, ${formatTimeLabel(formatTime(minutes))}`}>
      <span className="w-14 shrink-0 text-right text-xs font-extrabold text-primary" aria-hidden>
        Now
      </span>
      <span className="relative z-10 size-3 shrink-0 rounded-full bg-primary ring-3 ring-background" aria-hidden />
      <span className="h-0.5 flex-1 rounded-full bg-primary/70" aria-hidden />
      <span className="text-xs font-semibold text-primary" aria-hidden>
        {formatTimeLabel(formatTime(minutes))}
      </span>
    </li>
  )
}

function TimelineItem({
  item,
  overlapping,
  active,
  canWrite,
  onEdit,
  onCopy,
  onDelete,
}: {
  item: ScheduleItem
  overlapping: boolean
  active: boolean
  canWrite: boolean
  onEdit: (item: ScheduleItem) => void
  onCopy: (item: ScheduleItem) => void
  onDelete: (item: ScheduleItem) => void
}) {
  const start = formatTimeLabel(item.start_time)
  const end = formatTimeLabel(item.end_time)
  const duration = formatDuration(durationMinutes(item))

  return (
    <li className="relative flex gap-3">
      <div className="w-14 shrink-0 pt-3 text-right leading-tight">
        <span className="block text-sm font-bold tabular-nums">{start}</span>
        <span className="block text-xs text-muted-foreground tabular-nums">{end}</span>
      </div>
      <span
        aria-hidden
        className={cn(
          'relative z-10 mt-4 size-3 shrink-0 rounded-full ring-3 ring-background',
          active ? 'bg-primary' : overlapping ? 'bg-lemon' : 'bg-lavender',
        )}
      />
      <div
        className={cn(
          'glass flex min-w-0 flex-1 items-start gap-1 rounded-2xl p-1 transition-colors',
          active && 'ring-2 ring-primary',
          overlapping && !active && 'border-dashed border-lemon',
        )}
      >
        <button
          type="button"
          onClick={() => onEdit(item)}
          disabled={!canWrite}
          aria-label={`${item.title}, ${start} to ${end}${active ? ', happening now' : ''}${overlapping ? ', overlaps another plan' : ''}. Edit`}
          className="min-h-11 min-w-0 flex-1 rounded-xl px-2.5 py-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/60 disabled:cursor-default"
        >
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="break-words font-bold">{item.title}</span>
            {active ? (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[0.7rem] font-bold text-primary-foreground">Now</span>
            ) : null}
            {overlapping ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-lemon/70 px-2 py-0.5 text-[0.7rem] font-semibold">
                <Layers className="size-3" aria-hidden /> Overlaps
              </span>
            ) : null}
          </span>
          <span className="block text-xs text-muted-foreground">
            {start} – {end} · {duration}
          </span>
          {item.description ? (
            <span className="mt-1 block whitespace-pre-line break-words text-sm text-muted-foreground">{item.description}</span>
          ) : null}
        </button>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-11 shrink-0 rounded-xl" aria-label={`More options for ${item.title}`}>
              <MoreVertical className="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48 rounded-xl">
            <DropdownMenuItem className="min-h-11" disabled={!canWrite} onSelect={() => onEdit(item)}>
              <Pencil className="size-4" aria-hidden /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem className="min-h-11" disabled={!canWrite} onSelect={() => onCopy(item)}>
              <Copy className="size-4" aria-hidden /> Copy to other days
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="min-h-11" variant="destructive" disabled={!canWrite} onSelect={() => onDelete(item)}>
              <Trash2 className="size-4" aria-hidden /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  )
}
