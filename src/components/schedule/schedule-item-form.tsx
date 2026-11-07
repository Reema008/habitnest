import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Info } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useOnline } from '@/components/common/offline-banner'
import { useCreateScheduleItems, useUpdateScheduleItem } from '@/hooks/use-schedules'
import { WEEKDAY_LONG } from '@/lib/dates'
import { toUserMessage } from '@/lib/errors'
import {
  durationMinutes, formatDuration, isValidTime, normalizeTime, parseTime, rangesOverlap, suggestSlot,
} from '@/domain/schedule'
import type { ScheduleItem } from '@/types/models'
import { DayToggles } from './day-selector'

const schema = z
  .object({
    title: z.string().trim().min(1, 'Give it a title').max(80, 'Keep it to 80 characters or fewer'),
    description: z.string().trim().max(500, 'Keep it to 500 characters or fewer'),
    start: z.string().refine(isValidTime, 'Choose a start time'),
    end: z.string().refine(isValidTime, 'Choose an end time'),
    days: z.array(z.number().int().min(0).max(6)).min(1, 'Pick at least one day'),
  })
  .refine((v) => !isValidTime(v.start) || !isValidTime(v.end) || (parseTime(v.end) ?? 0) > (parseTime(v.start) ?? 0), {
    path: ['end'],
    message: 'End time needs to be after the start time',
  })
type Values = z.infer<typeof schema>

export type ScheduleEditorState = { mode: 'create'; day: number } | { mode: 'edit'; item: ScheduleItem } | null

/** Bottom drawer to add (to one or more days) or edit a schedule item. */
export function ScheduleItemDrawer({
  state,
  onClose,
  allItems,
}: {
  state: ScheduleEditorState
  onClose: () => void
  allItems: ScheduleItem[]
}) {
  return (
    <Drawer open={state !== null} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="mx-auto max-h-[92dvh] max-w-lg">
        {state ? (
          <ScheduleItemForm
            key={state.mode === 'edit' ? state.item.id : `new-${state.day}`}
            state={state}
            allItems={allItems}
            onDone={onClose}
          />
        ) : null}
      </DrawerContent>
    </Drawer>
  )
}

function ScheduleItemForm({
  state,
  allItems,
  onDone,
}: {
  state: NonNullable<ScheduleEditorState>
  allItems: ScheduleItem[]
  onDone: () => void
}) {
  const online = useOnline()
  const create = useCreateScheduleItems()
  const update = useUpdateScheduleItem()
  const editing = state.mode === 'edit' ? state.item : null

  const [defaults] = useState<Values>(() => {
    if (editing) {
      return {
        title: editing.title,
        description: editing.description ?? '',
        start: normalizeTime(editing.start_time) ?? '09:00',
        end: normalizeTime(editing.end_time) ?? '10:00',
        days: [editing.day_of_week],
      }
    }
    const day = state.mode === 'create' ? state.day : 1
    const slot = suggestSlot(allItems.filter((i) => i.day_of_week === day))
    return { title: '', description: '', start: slot.start, end: slot.end, days: [day] }
  })

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults, mode: 'onTouched' })
  const { errors, isSubmitting } = form.formState
  const [start, end, days] = useWatch({ control: form.control, name: ['start', 'end', 'days'] })

  const range = { start_time: start, end_time: end }
  const validRange = isValidTime(start) && isValidTime(end) && durationMinutes(range) > 0
  const overlapping = validRange
    ? allItems.filter((i) => i.id !== editing?.id && days.includes(i.day_of_week) && rangesOverlap(i, range))
    : []

  const onSubmit = form.handleSubmit(async (v) => {
    const base = {
      title: v.title,
      description: v.description ? v.description : null,
      start_time: v.start,
      end_time: v.end,
    }
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, patch: { ...base, day_of_week: v.days[0]! } })
        toast.success('Saved')
      } else {
        await create.mutateAsync(v.days.map((day) => ({ ...base, day_of_week: day })))
        toast.success(v.days.length > 1 ? `Added to ${v.days.length} days` : 'Added to your schedule')
      }
      onDone()
    } catch (e) {
      toast.error(toUserMessage(e))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-col">
      <DrawerHeader>
        <DrawerTitle className="text-lg font-extrabold">{editing ? 'Edit plan' : 'Add to schedule'}</DrawerTitle>
        <DrawerDescription>
          {editing ? `On ${WEEKDAY_LONG[editing.day_of_week]}s` : 'Pick a time and the days it happens.'}
        </DrawerDescription>
      </DrawerHeader>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-2">
        <div className="space-y-2">
          <Label htmlFor="schedule-title">Title</Label>
          <Input
            id="schedule-title"
            className="h-12"
            maxLength={80}
            placeholder="e.g. Piano practice"
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? 'schedule-title-error' : undefined}
            {...form.register('title')}
          />
          {errors.title ? (
            <p id="schedule-title-error" className="text-sm text-destructive">
              {errors.title.message}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="schedule-start">Starts</Label>
            <Input
              id="schedule-start"
              type="time"
              className="h-12"
              aria-invalid={!!errors.start}
              aria-describedby={errors.start ? 'schedule-start-error' : undefined}
              {...form.register('start')}
            />
            {errors.start ? (
              <p id="schedule-start-error" className="text-sm text-destructive">
                {errors.start.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="schedule-end">Ends</Label>
            <Input
              id="schedule-end"
              type="time"
              className="h-12"
              aria-invalid={!!errors.end}
              aria-describedby={errors.end ? 'schedule-end-error' : undefined}
              {...form.register('end', { deps: ['start'] })}
            />
            {errors.end ? (
              <p id="schedule-end-error" className="text-sm text-destructive">
                {errors.end.message}
              </p>
            ) : null}
          </div>
        </div>
        {validRange ? <p className="-mt-2 text-sm text-muted-foreground">Lasts {formatDuration(durationMinutes(range))}</p> : null}

        <div className="space-y-2">
          <p id="schedule-days-label" className="text-sm font-medium">
            {editing ? 'Day' : 'Days'}
          </p>
          <Controller
            control={form.control}
            name="days"
            render={({ field }) => (
              <DayToggles
                value={field.value}
                onChange={(next) => {
                  field.onChange(next)
                  field.onBlur()
                }}
                multiple={!editing}
                labelledBy="schedule-days-label"
                invalid={!!errors.days}
              />
            )}
          />
          {errors.days ? <p className="text-sm text-destructive">{errors.days.message}</p> : null}
        </div>

        {overlapping.length > 0 ? (
          <p role="status" className="flex gap-2 rounded-xl bg-lemon/50 px-3 py-2 text-sm">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Overlaps with {overlapping.slice(0, 2).map((i) => `“${i.title}”`).join(' and ')}
              {overlapping.length > 2 ? ` and ${overlapping.length - 2} more` : ''}. That's okay — just a heads-up.
            </span>
          </p>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="schedule-description">
            Notes <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="schedule-description"
            rows={3}
            maxLength={500}
            placeholder="Anything to remember"
            aria-invalid={!!errors.description}
            {...form.register('description')}
          />
          {errors.description ? <p className="text-sm text-destructive">{errors.description.message}</p> : null}
        </div>
      </div>

      <div className="safe-bottom flex gap-2 border-t border-border px-4 pt-3">
        <Button type="button" variant="secondary" className="h-12 flex-1" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" className="h-12 flex-1" disabled={!online || isSubmitting}>
          {isSubmitting ? 'Saving…' : editing ? 'Save' : 'Add'}
        </Button>
      </div>
      {!online ? (
        <p role="status" className="px-4 pb-3 text-center text-xs text-muted-foreground">
          You're offline — saving will be possible once you reconnect.
        </p>
      ) : null}
    </form>
  )
}
