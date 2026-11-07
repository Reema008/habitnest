import { useMemo } from 'react'
import { Link } from 'react-router'
import { CalendarCheck, ClipboardList, Flame, Sprout, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { GlassCard } from '@/components/common/glass-card'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { CalendarHeatmap, type HeatmapDay } from '@/components/charts/calendar-heatmap'
import { ProgressRing } from '@/components/charts/progress-ring'
import { SummaryCard } from '@/components/charts/summary-card'
import { formatPercent } from '@/components/charts/chart-format'
import { weeklySummaries, type DateRange, type DayCompletion } from '@/domain/report-aggregates'
import { usePersonalReport } from '@/hooks/use-reports'
import { todayISO } from '@/lib/dates'
import { HabitReportSection } from './habit-report-section'
import { WeeklySummaryList } from './weekly-summary-list'
import { clipToToday } from './period'

const ALL = 'all'

/** The signed-in member's own report for a period. */
export function PersonalReport({
  range,
  showWeeklySummaries,
  habitId,
  onHabitChange,
}: {
  range: DateRange
  showWeeklySummaries: boolean
  habitId: string | null
  onHabitChange: (habitId: string | null) => void
}) {
  const today = todayISO()
  const { availableHabits, report, bestStreak, isPending, error, refetch } = usePersonalReport(range, habitId)
  const chartRange = clipToToday(range, today)

  const activeHabits = availableHabits.filter((h) => !h.archived_at)
  const archivedHabits = availableHabits.filter((h) => h.archived_at)
  const selectedMissing = habitId !== null && !isPending && !availableHabits.some((h) => h.id === habitId)

  const weeks = useMemo(() => {
    if (!report || !showWeeklySummaries) return []
    return weeklySummaries(report.days, report.habits.flatMap((h) => h.numeric), report.range)
  }, [report, showWeeklySummaries])
  const habitNames = useMemo(() => new Map(availableHabits.map((h) => [h.id, h.name])), [availableHabits])

  if (error) return <ErrorState error={error} onRetry={refetch} />
  if (isPending || !report) return <LoadingState rows={4} />

  if (!availableHabits.length) {
    return (
      <EmptyState
        icon={Sprout}
        title="No habits in this period"
        description="Create a habit and check in — your progress will bloom here."
        action={
          <Button asChild className="h-11 rounded-xl">
            <Link to="/habits">Go to habits</Link>
          </Button>
        }
      />
    )
  }

  const { overall } = report
  const heatmapDays: HeatmapDay[] = report.days.map((d) => ({
    date: d.date,
    value: d.ratio,
    isFuture: d.isFuture,
    description: describeDay(d),
  }))

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="report-habit">Habit</Label>
        <Select value={selectedMissing ? ALL : (habitId ?? ALL)} onValueChange={(v) => onHabitChange(v === ALL ? null : v)}>
          <SelectTrigger id="report-habit" className="h-11 w-full rounded-xl bg-glass">
            <SelectValue placeholder="All habits" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL} className="min-h-11">
              All habits
            </SelectItem>
            {activeHabits.length ? (
              <SelectGroup>
                <SelectLabel>Active</SelectLabel>
                {activeHabits.map((h) => (
                  <SelectItem key={h.id} value={h.id} className="min-h-11">
                    {h.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            ) : null}
            {archivedHabits.length ? (
              <SelectGroup>
                <SelectLabel>Archived (with entries in this period)</SelectLabel>
                {archivedHabits.map((h) => (
                  <SelectItem key={h.id} value={h.id} className="min-h-11">
                    {h.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            ) : null}
          </SelectContent>
        </Select>
      </div>

      <GlassCard className="flex items-center gap-4">
        {overall.percent !== null ? (
          <ProgressRing value={overall.percent} size={96} label="Completion on scheduled days" />
        ) : (
          <ProgressRing value={0} size={96} label="Nothing scheduled yet in this period">
            <span className="text-lg font-bold text-muted-foreground">—</span>
          </ProgressRing>
        )}
        <div className="min-w-0 space-y-1">
          <h2 className="text-lg font-bold leading-tight">{headline(overall.percent)}</h2>
          <p className="text-sm text-muted-foreground">
            {overall.scheduled > 0
              ? `${overall.completed} of ${overall.scheduled} scheduled check-ins done`
              : 'No check-ins were scheduled in this period yet.'}
            {overall.bonus > 0 ? ` · ${overall.bonus} extra on rest days` : ''}
          </p>
        </div>
      </GlassCard>

      <div className="grid grid-cols-2 gap-3">
        <SummaryCard
          label="Completion"
          value={formatPercent(overall.percent)}
          hint="of scheduled days"
          icon={Target}
          tone="lavender"
        />
        <SummaryCard
          label="Days tracked"
          value={report.daysTracked}
          hint={`of ${report.elapsedDays} ${report.elapsedDays === 1 ? 'day' : 'days'} so far`}
          icon={CalendarCheck}
          tone="mint"
        />
        <SummaryCard
          label="Entries recorded"
          value={report.entriesRecorded}
          hint={report.entriesRecorded === 1 ? 'check-in' : 'check-ins'}
          icon={ClipboardList}
          tone="sky"
        />
        <SummaryCard
          label="Best current streak"
          value={bestStreak ? `${bestStreak.days} ${bestStreak.days === 1 ? 'day' : 'days'}` : '…'}
          hint={bestStreak?.habit ? bestStreak.habit.name : 'Every check-in starts one'}
          icon={Flame}
          tone="peach"
        />
      </div>

      <CalendarHeatmap
        days={heatmapDays}
        title="Completion calendar"
        description="Each day is coloured by how many scheduled habits were done."
      />

      {showWeeklySummaries && weeks.length ? <WeeklySummaryList weeks={weeks} habitNames={habitNames} /> : null}

      {report.entriesRecorded === 0 ? (
        <GlassCard className="text-sm text-muted-foreground">
          No entries in this period yet — every check-in you make will show up here.
        </GlassCard>
      ) : null}

      <section aria-labelledby="habit-details" className="space-y-6">
        <h2 id="habit-details" className="px-1 text-lg font-bold">
          {report.habits.length === 1 ? 'Habit details' : 'By habit'}
        </h2>
        {report.habits.map((h) => (
          <HabitReportSection key={h.habit.id} report={h} chartRange={chartRange} />
        ))}
      </section>
    </div>
  )
}

function headline(percent: number | null): string {
  if (percent === null) return 'A fresh page'
  if (percent >= 90) return 'Wonderfully consistent!'
  if (percent >= 70) return 'Great rhythm going'
  if (percent >= 40) return 'Building momentum'
  if (percent > 0) return 'Every step counts'
  return 'Ready when you are'
}

function describeDay(d: DayCompletion): string {
  if (d.isFuture) return 'upcoming'
  if (d.scheduled === 0) return d.bonus > 0 ? `nothing scheduled, ${d.bonus} extra done` : 'nothing scheduled'
  return `${d.completed} of ${d.scheduled} scheduled ${d.scheduled === 1 ? 'habit' : 'habits'} done`
}
