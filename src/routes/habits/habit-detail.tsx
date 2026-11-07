import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Archive, ArchiveRestore, CalendarDays, CircleCheck, CircleDot, Flame, NotebookPen, Pencil, Plus, Target, Trash2, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { GlassCard } from '@/components/common/glass-card'
import { HabitIcon } from '@/components/common/habit-visuals'
import { useOnline } from '@/components/common/offline-banner'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { SwitchRow } from '@/components/habits/field-editor'
import { HabitEntrySheet } from '@/components/habits/habit-entry-sheet'
import { definitionsByVersion, entryValues, filledFields, frequencySummary } from '@/components/habits/habit-format'
import { PrivacyBadge } from '@/components/habits/privacy-badge'
import { describeGoal } from '@/domain/completion'
import { formatFieldValue } from '@/domain/field-schema'
import { useHabitEntries } from '@/hooks/use-entries'
import { useDeleteHabit, useFieldDefinitions, useHabit, useHabitStreaks, useUpdateHabit } from '@/hooks/use-habits'
import { formatDay, friendlyDay, todayISO } from '@/lib/dates'
import { toUserMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { useCurrentUser } from '@/providers/auth-provider'
import type { FieldDefinition, HabitEntry, HabitVisibility, HabitWithFields } from '@/types/models'
import { HabitNotFound } from './habit-not-found'

const PAGE_SIZE = 20

export default function HabitDetailPage() {
  const { id } = useParams()
  const { userId } = useCurrentUser()
  const habitQuery = useHabit(id)
  const [deleting, setDeleting] = useState(false)

  if (habitQuery.isPending || (deleting && !habitQuery.data)) {
    return (
      <>
        <PageHeader title="Habit" back="/habits" />
        <LoadingState rows={4} />
      </>
    )
  }
  if (habitQuery.isError) {
    return (
      <>
        <PageHeader title="Habit" back="/habits" />
        <ErrorState error={habitQuery.error} onRetry={() => void habitQuery.refetch()} />
      </>
    )
  }
  const habit = habitQuery.data
  if (!habit || habit.owner_id !== userId) return <HabitNotFound />
  return <HabitDetail habit={habit} onDeleting={setDeleting} />
}

function HabitDetail({ habit, onDeleting }: { habit: HabitWithFields; onDeleting: (v: boolean) => void }) {
  const navigate = useNavigate()
  const online = useOnline()
  const today = todayISO()
  const updateHabit = useUpdateHabit()
  const deleteHabit = useDeleteHabit()
  const ids = useMemo(() => [habit.id], [habit.id])
  const streaks = useHabitStreaks(ids)
  const streak = streaks.data[habit.id]
  const entriesQuery = useHabitEntries(habit.id)
  const defsQuery = useFieldDefinitions(ids)
  const versions = useMemo(() => definitionsByVersion(defsQuery.data ?? [], habit.id), [defsQuery.data, habit.id])

  const [pendingVisibility, setPendingVisibility] = useState<HabitVisibility | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetTarget, setSheetTarget] = useState<{ date: string; entry?: HabitEntry } | null>(null)

  const archived = !!habit.archived_at
  const entries = entriesQuery.data ?? []
  const todayEntry = entries.find((e) => e.entry_date === today)
  const goal = describeGoal(habit, habit.fields)

  function openSheet(date: string, entry?: HabitEntry) {
    setSheetTarget({ date, entry })
    setSheetOpen(true)
  }

  async function changeVisibility(visibility: HabitVisibility) {
    try {
      await updateHabit.mutateAsync({ id: habit.id, patch: { visibility } })
      toast.success(visibility === 'family' ? 'Now shared with your family' : 'This habit is private now')
    } catch (e) {
      toast.error(toUserMessage(e))
    }
  }

  async function toggleArchive() {
    try {
      await updateHabit.mutateAsync({ id: habit.id, patch: { archived_at: archived ? null : new Date().toISOString() } })
      toast.success(
        archived ? "Welcome back! It's on your tracking list again." : 'Archived. It’s hidden from tracking — unarchive any time.',
      )
    } catch (e) {
      toast.error(toUserMessage(e))
    }
  }

  async function remove() {
    onDeleting(true)
    try {
      await deleteHabit.mutateAsync(habit.id)
      toast.success(`"${habit.name}" was deleted`)
      navigate('/habits', { replace: true })
    } catch (e) {
      onDeleting(false)
      toast.error(toUserMessage(e))
    }
  }

  const shared = habit.visibility === 'family'
  const busy = updateHabit.isPending || deleteHabit.isPending

  return (
    <div className="space-y-4">
      <PageHeader
        title={habit.name}
        subtitle={archived ? 'Archived' : frequencySummary(habit.frequency_days)}
        back="/habits"
        action={
          <Button asChild variant="secondary" className="h-11 rounded-full px-4">
            <Link to="edit">
              <Pencil className="size-4" /> Edit
            </Link>
          </Button>
        }
      />

      <GlassCard className="space-y-4">
        <div className="flex items-start gap-3">
          <HabitIcon icon={habit.icon} color={habit.color} className="size-14 rounded-2xl" iconClassName="size-7" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <PrivacyBadge visibility={habit.visibility} />
            {habit.description ? <p className="text-sm">{habit.description}</p> : null}
          </div>
        </div>
        <SwitchRow
          id="detail-share"
          label="Share with family"
          hint={shared ? 'Your family can see this habit, its entries and notes.' : 'Only you can see this habit.'}
          checked={shared}
          disabled={!online || busy}
          onCheckedChange={(on) => setPendingVisibility(on ? 'family' : 'private')}
        />
        <ConfirmDialog
          open={pendingVisibility !== null}
          onOpenChange={(o) => !o && setPendingVisibility(null)}
          destructive={false}
          title={pendingVisibility === 'family' ? `Share "${habit.name}" with your family?` : `Make "${habit.name}" private?`}
          description={
            pendingVisibility === 'family'
              ? 'Family members will be able to see this habit and all of its entries, including values and notes. It can also count toward family challenges and the leaderboard.'
              : 'Your family will no longer see this habit or any of its entries and notes. It will also be removed from any family challenges.'
          }
          confirmLabel={pendingVisibility === 'family' ? 'Share with family' : 'Make private'}
          onConfirm={() => {
            const v = pendingVisibility
            setPendingVisibility(null)
            if (v) void changeVisibility(v)
          }}
        />
      </GlassCard>

      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Flame} label="Current streak" value={streak ? dayCount(streak.current) : null} tone="bg-peach/50" />
        <StatCard icon={Trophy} label="Best streak" value={streak ? dayCount(streak.best) : null} tone="bg-lemon/50" />
      </div>

      <GlassCard className="space-y-3 text-sm">
        <InfoRow icon={Target} label="Goal" value={goal ?? 'Complete when all required fields are filled'} />
        <InfoRow icon={CalendarDays} label="Schedule" value={frequencySummary(habit.frequency_days)} />
        <InfoRow icon={NotebookPen} label="Notes" value={habit.notes_enabled ? 'Additional notes on' : 'Additional notes off'} />
      </GlassCard>

      {archived ? (
        <p className="rounded-xl bg-sky/40 px-3 py-2 text-sm">
          This habit is archived, so it's hidden from daily tracking. Unarchive it to pick it back up.
        </p>
      ) : (
        <Button className="h-12 w-full text-base" onClick={() => openSheet(today, todayEntry)} disabled={entriesQuery.isPending}>
          {todayEntry ? <Pencil className="size-5" /> : <Plus className="size-5" />}
          {todayEntry ? "Edit today's entry" : 'Record today'}
        </Button>
      )}

      <EntryHistory
        habit={habit}
        entries={entries}
        versions={versions}
        loading={entriesQuery.isPending}
        defsLoading={defsQuery.isPending}
        error={entriesQuery.isError ? entriesQuery.error : null}
        onRetry={() => void entriesQuery.refetch()}
        onOpen={(entry) => openSheet(entry.entry_date, entry)}
      />

      <section aria-labelledby="habit-actions" className="space-y-2 pt-2">
        <h2 id="habit-actions" className="sr-only">
          Habit actions
        </h2>
        <Button variant="secondary" className="h-12 w-full" onClick={() => void toggleArchive()} disabled={!online || busy}>
          {archived ? <ArchiveRestore className="size-5" /> : <Archive className="size-5" />}
          {archived ? 'Unarchive habit' : 'Archive habit'}
        </Button>
        <ConfirmDialog
          title={`Delete "${habit.name}"?`}
          description={`This permanently deletes the habit and all of its entries${
            entries.length ? ` (${entries.length}${entries.length >= 400 ? '+' : ''} recorded)` : ''
          }. This can't be undone. If you just want a break, archive it instead.`}
          confirmLabel="Delete habit"
          onConfirm={remove}
          trigger={
            <Button variant="destructive" className="h-12 w-full" disabled={!online || busy}>
              <Trash2 className="size-5" /> Delete habit
            </Button>
          }
        />
      </section>

      {sheetTarget ? (
        <HabitEntrySheet habit={habit} date={sheetTarget.date} entry={sheetTarget.entry} open={sheetOpen} onOpenChange={setSheetOpen} />
      ) : null}
    </div>
  )
}

function dayCount(n: number) {
  return `${n} ${n === 1 ? 'day' : 'days'}`
}

function StatCard({ icon: Icon, label, value, tone }: { icon: typeof Flame; label: string; value: string | null; tone: string }) {
  return (
    <GlassCard className="space-y-2">
      <span className={cn('flex size-9 items-center justify-center rounded-xl', tone)}>
        <Icon className="size-5 text-foreground/80" aria-hidden />
      </span>
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      {value === null ? <Skeleton className="h-7 w-16" /> : <p className="text-xl font-extrabold">{value}</p>}
    </GlassCard>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Flame; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <p className="break-words">{value}</p>
      </div>
    </div>
  )
}

function EntryHistory({
  habit,
  entries,
  versions,
  loading,
  defsLoading,
  error,
  onRetry,
  onOpen,
}: {
  habit: HabitWithFields
  entries: HabitEntry[]
  versions: Map<number, FieldDefinition[]>
  loading: boolean
  defsLoading: boolean
  error: unknown
  onRetry: () => void
  onOpen: (entry: HabitEntry) => void
}) {
  const [visible, setVisible] = useState(PAGE_SIZE)
  return (
    <section aria-labelledby="history-title" className="space-y-3">
      <h2 id="history-title" className="text-lg font-bold">
        History
      </h2>
      {loading ? (
        <LoadingState rows={3} />
      ) : error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No entries yet"
          description={habit.archived_at ? 'Entries you record will show up here.' : 'Your first entry is just a tap away — every journey starts somewhere.'}
        />
      ) : (
        <>
          <ul className="space-y-2">
            {entries.slice(0, visible).map((entry) => (
              <li key={entry.id}>
                <EntryRow
                  entry={entry}
                  fields={versions.get(entry.habit_version)}
                  fieldsLoading={defsLoading}
                  olderVersion={entry.habit_version !== habit.current_version}
                  onOpen={() => onOpen(entry)}
                />
              </li>
            ))}
          </ul>
          {visible < entries.length ? (
            <Button variant="secondary" className="h-11 w-full" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
              Show more ({entries.length - visible} more)
            </Button>
          ) : null}
        </>
      )}
    </section>
  )
}

function EntryRow({
  entry,
  fields,
  fieldsLoading,
  olderVersion,
  onOpen,
}: {
  entry: HabitEntry
  fields: FieldDefinition[] | undefined
  fieldsLoading: boolean
  olderVersion: boolean
  onOpen: () => void
}) {
  const values = entryValues(entry)
  const shown = fields ? filledFields(fields, values) : []
  return (
    <button
      type="button"
      onClick={onOpen}
      className="glass flex w-full flex-col gap-2 rounded-2xl p-4 text-left transition hover:bg-lavender/20 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <span className="flex w-full items-center gap-2">
        <span className="flex-1 font-semibold">
          <time dateTime={entry.entry_date} title={formatDay(entry.entry_date, 'EEEE d MMMM yyyy')}>
            {friendlyDay(entry.entry_date)}
          </time>
          <span className="sr-only">, edit entry</span>
        </span>
        {entry.is_complete ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-mint/60 px-2 py-0.5 text-xs font-semibold">
            <CircleCheck className="size-3.5 text-success" aria-hidden /> Complete
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-lavender/50 px-2 py-0.5 text-xs font-semibold">
            <CircleDot className="size-3.5" aria-hidden /> Recorded
          </span>
        )}
      </span>
      {fieldsLoading && !fields ? (
        <span aria-hidden className="block h-4 w-2/3 animate-pulse rounded bg-muted" />
      ) : fields ? (
        <span className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          {shown.map((f) => (
            <span key={f.field_key} className="contents">
              <span className="text-muted-foreground">{f.label}</span>
              <span className="min-w-0 font-medium break-words">{formatFieldValue(f, values[f.field_key])}</span>
            </span>
          ))}
        </span>
      ) : null}
      {entry.notes ? <span className="line-clamp-3 text-sm whitespace-pre-line text-muted-foreground italic">“{entry.notes}”</span> : null}
      {olderVersion ? <span className="text-xs text-muted-foreground">Recorded with an earlier version of this habit</span> : null}
    </button>
  )
}
