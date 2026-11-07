import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import {
  closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Archive, ArrowDown, ArrowUp, CalendarCheck, ChevronDown, ChevronRight, Flame, GripVertical, ListChecks, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/common/glass-card'
import { HabitIcon } from '@/components/common/habit-visuals'
import { useOnline } from '@/components/common/offline-banner'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { frequencySummary } from '@/components/habits/habit-format'
import { PrivacyBadge } from '@/components/habits/privacy-badge'
import { describeGoal } from '@/domain/completion'
import { useHabits, useHabitStreaks, useReorderHabits } from '@/hooks/use-habits'
import { toUserMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import type { HabitWithFields } from '@/types/models'

type Streak = { current: number; best: number } | undefined

export default function HabitsListPage() {
  const habitsQuery = useHabits({ includeArchived: true })
  const all = useMemo(() => habitsQuery.data ?? [], [habitsQuery.data])
  const active = useMemo(() => all.filter((h) => !h.archived_at), [all])
  const archived = useMemo(() => all.filter((h) => !!h.archived_at), [all])
  const activeIds = useMemo(() => active.map((h) => h.id), [active])
  const streaks = useHabitStreaks(activeIds)
  const sharedCount = active.filter((h) => h.visibility === 'family').length

  const header = (
    <PageHeader
      title="My habits"
      subtitle={habitsQuery.data ? `${sharedCount} of ${active.length} habits shared with family` : undefined}
      action={
        <Button asChild className="h-11 rounded-full px-4">
          <Link to="new">
            <Plus className="size-5" /> New habit
          </Link>
        </Button>
      }
    />
  )

  if (habitsQuery.isPending) {
    return (
      <>
        {header}
        <LoadingState rows={5} />
      </>
    )
  }
  if (habitsQuery.isError) {
    return (
      <>
        {header}
        <ErrorState error={habitsQuery.error} onRetry={() => void habitsQuery.refetch()} />
      </>
    )
  }

  return (
    <div className="space-y-4">
      {header}

      <Link
        to="/track"
        className="glass flex min-h-14 items-center gap-3 rounded-2xl px-4 py-3 transition hover:bg-lavender/30 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <span className="flex size-10 items-center justify-center rounded-xl bg-mint">
          <CalendarCheck className="size-5 text-foreground/80" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold">Track today</span>
          <span className="block text-sm text-muted-foreground">Record how today went</span>
        </span>
        <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
      </Link>

      {active.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title={archived.length ? 'No active habits' : 'No habits yet'}
          description="Create a habit that fits your day — track hours, choices or notes, your way."
          action={
            <Button asChild className="h-11">
              <Link to="new">
                <Plus className="size-5" /> Create a habit
              </Link>
            </Button>
          }
        />
      ) : (
        <ActiveHabitList habits={active} streaks={streaks.data} />
      )}

      {archived.length ? <ArchivedSection habits={archived} /> : null}
    </div>
  )
}

function ActiveHabitList({ habits, streaks }: { habits: HabitWithFields[]; streaks: Record<string, { current: number; best: number }> }) {
  const online = useOnline()
  const reorder = useReorderHabits()
  // Optimistic order while a reorder is being saved.
  const [pendingOrder, setPendingOrder] = useState<string[] | null>(null)

  const ordered = useMemo(() => {
    if (!pendingOrder) return habits
    const byId = new Map(habits.map((h) => [h.id, h]))
    const list = pendingOrder.map((id) => byId.get(id)).filter((h): h is HabitWithFields => !!h)
    return [...list, ...habits.filter((h) => !pendingOrder.includes(h.id))]
  }, [habits, pendingOrder])
  const ids = useMemo(() => ordered.map((h) => h.id), [ordered])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function commit(next: string[]) {
    setPendingOrder(next)
    reorder.mutate(next, {
      onError: (e) => toast.error(toUserMessage(e)),
      onSettled: () => setPendingOrder(null),
    })
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    commit(arrayMove(ids, from, to))
  }

  function move(index: number, dir: -1 | 1) {
    const to = index + dir
    if (to < 0 || to >= ids.length) return
    commit(arrayMove(ids, index, to))
  }

  const disabled = !online || reorder.isPending
  return (
    <section aria-labelledby="active-habits" className="space-y-2">
      <h2 id="active-habits" className="sr-only">
        Active habits
      </h2>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul className="space-y-3">
            {ordered.map((habit, i) => (
              <SortableHabitRow
                key={habit.id}
                habit={habit}
                streak={streaks[habit.id]}
                index={i}
                count={ordered.length}
                disabled={disabled}
                onMove={(dir) => move(i, dir)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      {!online ? <p className="text-center text-xs text-muted-foreground">Reordering is paused while you're offline.</p> : null}
    </section>
  )
}

function SortableHabitRow({
  habit,
  streak,
  index,
  count,
  disabled,
  onMove,
}: {
  habit: HabitWithFields
  streak: Streak
  index: number
  count: number
  disabled: boolean
  onMove: (dir: -1 | 1) => void
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: habit.id,
    disabled,
  })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('glass relative flex items-stretch rounded-2xl', isDragging && 'z-10 shadow-xl')}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder ${habit.name}`}
        disabled={disabled}
        className="flex w-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-l-2xl text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
      >
        <GripVertical className="size-5" aria-hidden />
      </button>
      <HabitSummaryLink habit={habit} streak={streak} className="py-3 pr-1" />
      <div className="flex shrink-0 flex-col justify-center">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11"
          aria-label={`Move ${habit.name} up`}
          disabled={disabled || index === 0}
          onClick={() => onMove(-1)}
        >
          <ArrowUp className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11"
          aria-label={`Move ${habit.name} down`}
          disabled={disabled || index === count - 1}
          onClick={() => onMove(1)}
        >
          <ArrowDown className="size-4" />
        </Button>
      </div>
    </li>
  )
}

function HabitSummaryLink({ habit, streak, className }: { habit: HabitWithFields; streak?: Streak; className?: string }) {
  const goal = describeGoal(habit, habit.fields)
  return (
    <Link
      to={habit.id}
      className={cn(
        'flex min-w-0 flex-1 items-start gap-3 rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        className,
      )}
    >
      <HabitIcon icon={habit.icon} color={habit.color} className="mt-0.5" />
      <span className="min-w-0 flex-1 space-y-1">
        <span className="block truncate font-bold">{habit.name}</span>
        <PrivacyBadge visibility={habit.visibility} />
        <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {streak !== undefined ? (
            <span className="inline-flex items-center gap-1">
              <Flame className={cn('size-3.5', streak.current > 0 && 'text-peach')} aria-hidden />
              {streak.current > 0 ? `${streak.current}-day streak` : 'Ready for a streak'}
            </span>
          ) : null}
          <span>{frequencySummary(habit.frequency_days)}</span>
        </span>
        <span className="line-clamp-1 text-xs text-muted-foreground">{goal ? `Goal · ${goal}` : 'Complete when filled in'}</span>
      </span>
    </Link>
  )
}

function ArchivedSection({ habits }: { habits: HabitWithFields[] }) {
  const [open, setOpen] = useState(false)
  return (
    <section className="space-y-3">
      <Button
        type="button"
        variant="ghost"
        className="h-11 w-full justify-between rounded-2xl px-4 text-base"
        aria-expanded={open}
        aria-controls="archived-habits"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="inline-flex items-center gap-2">
          <Archive className="size-5" aria-hidden /> Archived ({habits.length})
        </span>
        <ChevronDown className={cn('size-5 transition-transform', open && 'rotate-180')} aria-hidden />
      </Button>
      {open ? (
        <ul id="archived-habits" className="space-y-3">
          {habits.map((habit) => (
            <GlassCard as="li" key={habit.id} className="flex p-3 opacity-90">
              <HabitSummaryLink habit={habit} />
            </GlassCard>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
