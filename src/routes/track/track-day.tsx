import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Check, ChevronDown, CircleDot, ListChecks, Plus, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { GlassCard } from '@/components/common/glass-card'
import { HabitIcon } from '@/components/common/habit-visuals'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { HabitEntrySheet } from '@/components/habits/habit-entry-sheet'
import { definitionsByVersion, entryValues, filledFields } from '@/components/habits/habit-format'
import { PrivacyBadge } from '@/components/habits/privacy-badge'
import { formatFieldValue } from '@/domain/field-schema'
import { useEntriesForDate } from '@/hooks/use-entries'
import { useActiveHabits, useFieldDefinitions } from '@/hooks/use-habits'
import { dayOfWeek, formatDay, todayISO, WEEKDAY_LONG } from '@/lib/dates'
import { cn } from '@/lib/utils'
import type { FieldDefinition, HabitEntry, HabitWithFields } from '@/types/models'
import { DateNavigator } from './date-navigator'

type Row = { habit: HabitWithFields; entry?: HabitEntry }

/** Daily tracking for one day (defaults to today). */
export default function TrackDayPage({ date: dateProp }: { date?: string }) {
  const navigate = useNavigate()
  const today = todayISO()
  const date = dateProp ?? today
  const habitsQuery = useActiveHabits()
  const entriesQuery = useEntriesForDate(date)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const habits = useMemo(() => habitsQuery.data ?? [], [habitsQuery.data])
  const entriesByHabit = useMemo(() => new Map((entriesQuery.data ?? []).map((e) => [e.habit_id, e])), [entriesQuery.data])

  // Entries recorded with an older version render with that version's definitions.
  const olderVersionHabitIds = useMemo(
    () =>
      habits
        .filter((h) => {
          const e = entriesByHabit.get(h.id)
          return e && e.habit_version !== h.current_version
        })
        .map((h) => h.id),
    [habits, entriesByHabit],
  )
  const defsQuery = useFieldDefinitions(olderVersionHabitIds)

  const weekday = dayOfWeek(date)
  const rows: Row[] = habits.map((habit) => ({ habit, entry: entriesByHabit.get(habit.id) }))
  const scheduled = rows.filter((r) => r.habit.frequency_days.includes(weekday))
  const unscheduled = rows.filter((r) => !r.habit.frequency_days.includes(weekday))
  const completeCount = scheduled.filter((r) => r.entry?.is_complete).length

  function fieldsFor(row: Row): FieldDefinition[] | undefined {
    if (!row.entry) return row.habit.fields
    if (row.entry.habit_version === row.habit.current_version) return row.habit.fields
    return definitionsByVersion(defsQuery.data ?? [], row.habit.id).get(row.entry.habit_version)
  }

  function goTo(next: string) {
    navigate(next === today ? '/track' : `/track/${next}`)
  }

  function open(habitId: string) {
    setSelectedId(habitId)
    setSheetOpen(true)
  }

  const selected = rows.find((r) => r.habit.id === selectedId)
  const loading = habitsQuery.isPending || entriesQuery.isPending
  const error = habitsQuery.error ?? entriesQuery.error

  return (
    <div className="space-y-4">
      <PageHeader
        title="Track"
        subtitle={formatDay(date, 'EEEE d MMMM')}
        action={
          <Button asChild variant="ghost" className="h-11 rounded-full px-3">
            <Link to="/habits">
              <Settings2 className="size-5" /> Habits
            </Link>
          </Button>
        }
      />
      <DateNavigator date={date} today={today} onChange={goTo} />

      {loading ? (
        <LoadingState rows={4} />
      ) : error ? (
        <ErrorState
          error={error}
          onRetry={() => {
            void habitsQuery.refetch()
            void entriesQuery.refetch()
          }}
        />
      ) : habits.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No active habits"
          description="Create a habit (or unarchive one) to start tracking."
          action={
            <Button asChild className="h-11">
              <Link to="/habits/new">
                <Plus className="size-5" /> New habit
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <DaySummary complete={completeCount} total={scheduled.length} isToday={date === today} weekday={weekday} />

          {scheduled.length ? (
            <section aria-labelledby="scheduled-title" className="space-y-2">
              <h2 id="scheduled-title" className="sr-only">
                Scheduled habits
              </h2>
              <ul className="space-y-2">
                {scheduled.map((row) => (
                  <li key={row.habit.id}>
                    <TrackRow row={row} fields={fieldsFor(row)} fieldsLoading={defsQuery.isPending} onOpen={() => open(row.habit.id)} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {unscheduled.length ? (
            <UnscheduledSection
              rows={unscheduled}
              fieldsFor={fieldsFor}
              fieldsLoading={defsQuery.isPending}
              onOpen={open}
              title={date === today ? 'Not scheduled today' : `Not scheduled on ${WEEKDAY_LONG[weekday]}s`}
              defaultOpen={scheduled.length === 0}
            />
          ) : null}
        </>
      )}

      {selected ? (
        <HabitEntrySheet habit={selected.habit} date={date} entry={selected.entry} open={sheetOpen} onOpenChange={setSheetOpen} />
      ) : null}
    </div>
  )
}

function DaySummary({ complete, total, isToday, weekday }: { complete: number; total: number; isToday: boolean; weekday: number }) {
  const pct = total ? Math.round((complete / total) * 100) : 0
  let message: string
  if (total === 0) message = `Nothing scheduled on ${WEEKDAY_LONG[weekday]}s — you can still record any habit below.`
  else if (complete === total) message = 'Everything done — wonderful work!'
  else if (complete === 0) message = isToday ? 'A fresh start — pick any habit to begin.' : 'Fill in anything you remember — every entry helps.'
  else message = 'Nice progress — keep it going!'

  return (
    <GlassCard className="space-y-3" aria-live="polite">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xl font-extrabold">{total ? `${complete} of ${total} complete` : 'Free day'}</p>
        {total ? <p className="text-sm font-semibold text-muted-foreground">{pct}%</p> : null}
      </div>
      {total ? <Progress value={pct} className="h-2.5 bg-lavender/50" aria-label={`${complete} of ${total} habits complete`} /> : null}
      <p className="text-sm text-muted-foreground">{message}</p>
    </GlassCard>
  )
}

function UnscheduledSection({
  rows,
  fieldsFor,
  fieldsLoading,
  onOpen,
  title,
  defaultOpen,
}: {
  rows: Row[]
  title: string
  fieldsFor: (row: Row) => FieldDefinition[] | undefined
  fieldsLoading: boolean
  onOpen: (habitId: string) => void
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="space-y-2">
      <Button
        type="button"
        variant="ghost"
        className="h-11 w-full justify-between rounded-2xl px-4 text-base"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span>
          {title} ({rows.length})
        </span>
        <ChevronDown className={cn('size-5 transition-transform', open && 'rotate-180')} aria-hidden />
      </Button>
      {open ? (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.habit.id}>
              <TrackRow row={row} fields={fieldsFor(row)} fieldsLoading={fieldsLoading} onOpen={() => onOpen(row.habit.id)} />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function TrackRow({
  row,
  fields,
  fieldsLoading,
  onOpen,
}: {
  row: Row
  fields: FieldDefinition[] | undefined
  fieldsLoading: boolean
  onOpen: () => void
}) {
  const { habit, entry } = row
  const state: 'complete' | 'recorded' | 'empty' = entry ? (entry.is_complete ? 'complete' : 'recorded') : 'empty'
  const values = entry ? entryValues(entry) : {}
  const summary =
    entry && fields
      ? filledFields(fields, values)
          .slice(0, 3)
          .map((f) => formatFieldValue(f, values[f.field_key]))
          .join(' · ')
      : ''

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'glass flex min-h-16 w-full items-center gap-3 rounded-2xl p-3 text-left transition hover:bg-lavender/20 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        state === 'complete' && 'bg-mint/30',
      )}
    >
      <HabitIcon icon={habit.icon} color={habit.color} />
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="block truncate font-bold">{habit.name}</span>
        <PrivacyBadge visibility={habit.visibility} />
        <span className="block truncate text-sm text-muted-foreground">
          {state === 'empty' ? (
            'Tap to record'
          ) : fieldsLoading && !fields ? (
            <span aria-hidden className="inline-block h-3.5 w-24 animate-pulse rounded bg-muted align-middle" />
          ) : state === 'complete' ? (
            summary || 'Complete'
          ) : (
            `${summary ? `${summary} · ` : ''}Recorded — keep going!`
          )}
        </span>
      </span>
      <StatusMark state={state} />
    </button>
  )
}

function StatusMark({ state }: { state: 'complete' | 'recorded' | 'empty' }) {
  if (state === 'complete') {
    return (
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success text-white">
        <Check className="size-5" aria-hidden strokeWidth={3} />
        <span className="sr-only">Complete</span>
      </span>
    )
  }
  if (state === 'recorded') {
    return (
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-peach/60">
        <CircleDot className="size-5 text-foreground/70" aria-hidden />
        <span className="sr-only">Recorded, goal not reached yet</span>
      </span>
    )
  }
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/40">
      <span className="sr-only">Not recorded</span>
    </span>
  )
}
