import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { CalendarPlus, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { useOnline } from '@/components/common/offline-banner'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { backTarget } from '@/components/profile/back-target'
import { CopyDaysDrawer } from '@/components/schedule/copy-days-drawer'
import { DayChips } from '@/components/schedule/day-selector'
import { ScheduleItemDrawer, type ScheduleEditorState } from '@/components/schedule/schedule-item-form'
import { ScheduleTimeline } from '@/components/schedule/schedule-timeline'
import { useNow } from '@/components/schedule/use-now'
import { useDeleteScheduleItem, useSchedules } from '@/hooks/use-schedules'
import { WEEKDAY_LONG } from '@/lib/dates'
import { toUserMessage } from '@/lib/errors'
import { durationMinutes, findOverlappingIds, formatDuration, groupByDay, minutesSinceMidnight } from '@/domain/schedule'
import type { ScheduleItem } from '@/types/models'

function parseDay(value: string | null): number | null {
  if (value === null || !/^[0-6]$/.test(value)) return null
  return Number(value)
}

export default function SchedulePage() {
  const online = useOnline()
  const now = useNow()
  const today = now.getDay()
  const [params, setParams] = useSearchParams()
  const day = parseDay(params.get('day')) ?? today

  const query = useSchedules()
  const remove = useDeleteScheduleItem()
  const [editor, setEditor] = useState<ScheduleEditorState>(null)
  const [copying, setCopying] = useState<ScheduleItem | null>(null)
  const [deleting, setDeleting] = useState<ScheduleItem | null>(null)

  const allItems = useMemo(() => query.data ?? [], [query.data])
  const groups = useMemo(() => groupByDay(allItems), [allItems])
  const items = useMemo(() => groups[day] ?? [], [groups, day])
  const overlaps = useMemo(() => findOverlappingIds(items), [items])
  const counts = useMemo(
    () => Object.fromEntries(Object.entries(groups).map(([d, list]) => [Number(d), list.length])) as Record<number, number>,
    [groups],
  )
  const totalMinutes = items.reduce((sum, i) => sum + durationMinutes(i), 0)

  function selectDay(next: number) {
    setParams(next === today ? {} : { day: String(next) }, { replace: true })
  }

  async function confirmDelete() {
    const item = deleting
    if (!item) return
    try {
      await remove.mutateAsync(item.id)
      toast.success(`Removed “${item.title}”`)
    } catch (e) {
      toast.error(toUserMessage(e))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="My schedule"
        subtitle="Your week, your rhythm"
        back={backTarget('/profile')}
        action={
          <Button
            size="icon"
            className="size-11 rounded-full"
            aria-label={`Add to ${WEEKDAY_LONG[day]}`}
            disabled={!online}
            onClick={() => setEditor({ mode: 'create', day })}
          >
            <Plus className="size-6" />
          </Button>
        }
      />

      <DayChips value={day} onChange={selectDay} today={today} counts={counts} />

      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-extrabold">
          {WEEKDAY_LONG[day]}
          {day === today ? <span className="ml-2 text-sm font-semibold text-primary">Today</span> : null}
        </h2>
        {items.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            {items.length} {items.length === 1 ? 'plan' : 'plans'} · {formatDuration(totalMinutes)}
          </p>
        ) : null}
      </div>

      {query.isPending ? (
        <LoadingState rows={3} />
      ) : query.error && !query.data ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={CalendarPlus}
          title={`Nothing planned for ${WEEKDAY_LONG[day]}`}
          description="Add things like school, practice, chores or wind-down time — whatever helps your day flow."
          action={
            <Button className="h-12 px-6" disabled={!online} onClick={() => setEditor({ mode: 'create', day })}>
              <Plus className="size-5" /> Add a plan
            </Button>
          }
        />
      ) : (
        <>
          <ScheduleTimeline
            items={items}
            overlaps={overlaps}
            nowMinutes={day === today ? minutesSinceMidnight(now) : null}
            canWrite={online}
            onEdit={(item) => setEditor({ mode: 'edit', item })}
            onCopy={setCopying}
            onDelete={setDeleting}
          />
          {overlaps.size > 0 ? (
            <p className="text-center text-xs text-muted-foreground">
              Some plans overlap — that's fine, it's just a friendly heads-up.
            </p>
          ) : null}
        </>
      )}

      <ScheduleItemDrawer state={editor} onClose={() => setEditor(null)} allItems={allItems} />
      <CopyDaysDrawer item={copying} allItems={allItems} onClose={() => setCopying(null)} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={deleting ? `Delete “${deleting.title}”?` : 'Delete plan?'}
        description={deleting ? `It will be removed from ${WEEKDAY_LONG[deleting.day_of_week]}. Other days stay as they are.` : undefined}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
      />
    </div>
  )
}
