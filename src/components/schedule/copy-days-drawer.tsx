import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { useOnline } from '@/components/common/offline-banner'
import { useCreateScheduleItems } from '@/hooks/use-schedules'
import { WEEKDAY_LONG } from '@/lib/dates'
import { toUserMessage } from '@/lib/errors'
import { formatTimeLabel, normalizeTime } from '@/domain/schedule'
import type { ScheduleItem } from '@/types/models'
import { DayToggles } from './day-selector'

/** Copies an item to other weekdays. Days that already have the identical item are skipped. */
export function CopyDaysDrawer({
  item,
  allItems,
  onClose,
}: {
  item: ScheduleItem | null
  allItems: ScheduleItem[]
  onClose: () => void
}) {
  return (
    <Drawer open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="mx-auto max-w-lg">
        {item ? <CopyForm key={item.id} item={item} allItems={allItems} onDone={onClose} /> : null}
      </DrawerContent>
    </Drawer>
  )
}

function sameSlot(a: ScheduleItem, b: ScheduleItem): boolean {
  return (
    a.title.trim() === b.title.trim() &&
    normalizeTime(a.start_time) === normalizeTime(b.start_time) &&
    normalizeTime(a.end_time) === normalizeTime(b.end_time)
  )
}

function CopyForm({ item, allItems, onDone }: { item: ScheduleItem; allItems: ScheduleItem[]; onDone: () => void }) {
  const online = useOnline()
  const create = useCreateScheduleItems()
  const [days, setDays] = useState<number[]>([])
  const taken = [item.day_of_week, ...allItems.filter((i) => i.id !== item.id && sameSlot(i, item)).map((i) => i.day_of_week)]

  async function copy() {
    try {
      await create.mutateAsync(
        days.map((day) => ({
          day_of_week: day,
          title: item.title,
          description: item.description,
          start_time: item.start_time,
          end_time: item.end_time,
        })),
      )
      toast.success(days.length === 1 ? `Copied to ${WEEKDAY_LONG[days[0]!]}` : `Copied to ${days.length} days`)
      onDone()
    } catch (e) {
      toast.error(toUserMessage(e))
    }
  }

  return (
    <div className="space-y-4 px-4 pb-6">
      <DrawerHeader className="px-0">
        <DrawerTitle className="text-lg font-extrabold">Copy “{item.title}”</DrawerTitle>
        <DrawerDescription>
          {formatTimeLabel(item.start_time)} – {formatTimeLabel(item.end_time)}. Choose the days to add it to.
        </DrawerDescription>
      </DrawerHeader>
      <p id="copy-days-label" className="sr-only">
        Days to copy to
      </p>
      <DayToggles value={days} onChange={setDays} multiple disabledDays={taken} labelledBy="copy-days-label" />
      {taken.length > 1 ? (
        <p className="text-xs text-muted-foreground">Greyed-out days already have this plan.</p>
      ) : null}
      <div className="flex gap-2">
        <Button variant="secondary" className="h-12 flex-1" onClick={onDone}>
          Cancel
        </Button>
        <Button className="h-12 flex-1" disabled={!online || days.length === 0 || create.isPending} onClick={() => void copy()}>
          {create.isPending ? 'Copying…' : days.length > 1 ? `Copy to ${days.length} days` : 'Copy'}
        </Button>
      </div>
      {!online ? (
        <p role="status" className="text-center text-xs text-muted-foreground">
          You're offline — copying will be possible once you reconnect.
        </p>
      ) : null}
    </div>
  )
}
