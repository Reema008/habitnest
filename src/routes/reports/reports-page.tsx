import { useSearchParams } from 'react-router'
import { User, Users } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { PageHeader } from '@/components/common/page-header'
import { FamilyComparison } from '@/components/reports/family-comparison'
import { PersonalReport } from '@/components/reports/personal-report'
import { PeriodNavigator } from '@/components/reports/period-navigator'
import { periodRange, rangeLabel } from '@/components/reports/period'
import { MAX_REPORT_DAYS, validateCustomRange, type DateRange } from '@/domain/report-aggregates'
import { isISODate, shiftDate, todayISO, type ISODate } from '@/lib/dates'

type View = 'week' | 'month' | 'custom'
type Scope = 'personal' | 'family'

const VIEWS: { value: View; label: string }[] = [
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
  { value: 'custom', label: 'Custom' },
]

/** /reports — personal reports by week, month or custom range, plus a family comparison scope. */
export default function ReportsPage() {
  const today = todayISO()
  const [params, setParams] = useSearchParams()

  const view: View = params.get('view') === 'month' ? 'month' : params.get('view') === 'custom' ? 'custom' : 'week'
  const scope: Scope = params.get('scope') === 'family' ? 'family' : 'personal'
  const rawDate = params.get('date')
  const anchor: ISODate = isISODate(rawDate) && rawDate <= today ? rawDate : today
  const rawFrom = params.get('from')
  const rawTo = params.get('to')
  const customFrom = rawFrom ?? shiftDate(today, -29)
  const customTo = rawTo ?? today
  const habitId = params.get('habit')

  function update(changes: Record<string, string | null>) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(changes)) {
          if (v === null) next.delete(k)
          else next.set(k, v)
        }
        return next
      },
      { replace: true },
    )
  }

  const customError = view === 'custom' ? validateCustomRange(customFrom, customTo, today) : null
  const range: DateRange | null =
    view === 'custom' ? (customError ? null : { start: customFrom, end: customTo }) : periodRange(view, anchor)

  return (
    <div className="space-y-4 pb-6">
      <PageHeader title="Reports" subtitle="See how your habits are growing" />

      <ToggleGroup
        type="single"
        value={scope}
        onValueChange={(v) => {
          if (v === 'personal' || v === 'family') update({ scope: v === 'family' ? 'family' : null })
        }}
        aria-label="Report scope"
        spacing={0}
        className="glass w-full rounded-2xl p-1"
      >
        <ToggleGroupItem value="personal" className="h-11 flex-1 gap-2 rounded-xl data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
          <User className="size-4" aria-hidden /> Personal
        </ToggleGroupItem>
        <ToggleGroupItem value="family" className="h-11 flex-1 gap-2 rounded-xl data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
          <Users className="size-4" aria-hidden /> Family
        </ToggleGroupItem>
      </ToggleGroup>

      <Tabs value={view} onValueChange={(v) => update({ view: v === 'week' ? null : v })}>
        <TabsList className="glass h-12 w-full rounded-2xl p-1 group-data-horizontal/tabs:h-12" aria-label="Report period">
          {VIEWS.map((v) => (
            <TabsTrigger key={v.value} value={v.value} className="h-10 rounded-xl data-[state=active]:bg-background">
              {v.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {VIEWS.map((v) => (
          <TabsContent key={v.value} value={v.value} className="space-y-4 text-base focus-visible:outline-none">
            {view === 'custom' ? (
              <CustomRangeFields
                from={customFrom}
                to={customTo}
                today={today}
                error={customError}
                onChange={(from, to) => update({ from, to })}
              />
            ) : (
              <PeriodNavigator kind={view} anchor={anchor} today={today} onChange={(d) => update({ date: d === today ? null : d })} />
            )}

            {range ? (
              scope === 'family' ? (
                <FamilyComparison range={range} />
              ) : (
                <PersonalReport
                  key={`${range.start}-${range.end}`}
                  range={range}
                  showWeeklySummaries={view === 'month'}
                  habitId={habitId}
                  onHabitChange={(id) => update({ habit: id })}
                />
              )
            ) : null}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

function CustomRangeFields({
  from,
  to,
  today,
  error,
  onChange,
}: {
  from: string
  to: string
  today: ISODate
  error: string | null
  onChange: (from: string, to: string) => void
}) {
  return (
    <fieldset className="glass space-y-3 rounded-2xl p-3" aria-describedby="custom-range-help">
      <legend className="sr-only">Custom date range</legend>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="report-from">From</Label>
          <Input
            id="report-from"
            type="date"
            className="h-11 rounded-xl"
            value={from}
            max={to && to < today ? to : today}
            aria-invalid={!!error}
            onChange={(e) => onChange(e.target.value, to)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="report-to">To</Label>
          <Input
            id="report-to"
            type="date"
            className="h-11 rounded-xl"
            value={to}
            min={from || undefined}
            max={today}
            aria-invalid={!!error}
            onChange={(e) => onChange(from, e.target.value)}
          />
        </div>
      </div>
      {error ? (
        <p id="custom-range-help" role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : (
        <p id="custom-range-help" className="text-xs text-muted-foreground">
          {rangeLabel({ start: from, end: to })} · up to {MAX_REPORT_DAYS} days, ending today at the latest
        </p>
      )}
    </fieldset>
  )
}
