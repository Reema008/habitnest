import { useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { HabitIcon } from '@/components/common/habit-visuals'
import { useOnline } from '@/components/common/offline-banner'
import { ErrorState, LoadingState } from '@/components/common/states'
import { useDeleteEntry, useSaveEntry } from '@/hooks/use-entries'
import { useFieldDefinitions } from '@/hooks/use-habits'
import { friendlyDay } from '@/lib/dates'
import { toUserMessage } from '@/lib/errors'
import type { FieldValues, HabitEntry, HabitWithFields } from '@/types/models'
import { HabitEntryForm } from './habit-entry-form'
import { definitionsByVersion, entryValues } from './habit-format'
import { PrivacyBadge } from './privacy-badge'

export type HabitEntrySheetProps = {
  habit: HabitWithFields
  /** ISO day (YYYY-MM-DD) the entry belongs to. */
  date: string
  /** The existing entry for (habit, date), if any. */
  entry?: HabitEntry
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Bottom drawer to record, edit or delete the entry of one habit on one day. */
export function HabitEntrySheet({ habit, date, entry, open, onOpenChange }: HabitEntrySheetProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-lg rounded-t-3xl">
        <DrawerHeader className="flex-row items-center gap-3 text-left group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left">
          <HabitIcon icon={habit.icon} color={habit.color} />
          <div className="min-w-0 flex-1">
            <DrawerTitle className="truncate text-lg font-bold">{habit.name}</DrawerTitle>
            <DrawerDescription>
              {friendlyDay(date)} · {entry ? 'Edit your entry' : 'Record your entry'}
            </DrawerDescription>
          </div>
          <PrivacyBadge visibility={habit.visibility} />
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {open ? <SheetBody habit={habit} date={date} entry={entry} onDone={() => onOpenChange(false)} /> : null}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

function dayPhrase(date: string): string {
  const day = friendlyDay(date)
  return day === 'Today' || day === 'Yesterday' ? day.toLowerCase() : day
}

function SheetBody({ habit, date, entry, onDone }: { habit: HabitWithFields; date: string; entry?: HabitEntry; onDone: () => void }) {
  const online = useOnline()
  const saveEntry = useSaveEntry()
  const deleteEntry = useDeleteEntry()
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Existing entries are edited with the definitions of their own version.
  const version = entry?.habit_version ?? habit.current_version
  const needsOldDefs = version !== habit.current_version
  const ids = useMemo(() => (needsOldDefs ? [habit.id] : []), [needsOldDefs, habit.id])
  const defsQuery = useFieldDefinitions(ids)
  const fields = useMemo(
    () => (needsOldDefs ? (definitionsByVersion(defsQuery.data ?? [], habit.id).get(version) ?? []) : habit.fields),
    [needsOldDefs, defsQuery.data, habit.id, habit.fields, version],
  )
  const defaults = useMemo(() => (entry ? entryValues(entry) : undefined), [entry])

  if (needsOldDefs && defsQuery.isPending) return <LoadingState rows={2} />
  if (needsOldDefs && defsQuery.isError) return <ErrorState error={defsQuery.error} onRetry={() => void defsQuery.refetch()} />
  if (!fields.length) {
    return <ErrorState error={new Error('This habit has no fields to record yet. Edit the habit to add one.')} />
  }

  async function handleSubmit(values: FieldValues, notes: string | null) {
    const saved = await saveEntry.mutateAsync({ habitId: habit.id, date, habitVersion: version, values, notes })
    toast.success(saved.is_complete ? `${habit.name} complete — wonderful!` : `${habit.name} saved. Every bit counts!`)
    onDone()
  }

  async function handleDelete() {
    if (!entry) return
    try {
      await deleteEntry.mutateAsync(entry.id)
      toast.success('Entry deleted')
      onDone()
    } catch (e) {
      toast.error(toUserMessage(e))
    }
  }

  return (
    <div className="space-y-4">
      {needsOldDefs ? (
        <p className="rounded-xl bg-sky/40 px-3 py-2 text-sm">
          This entry was recorded with an earlier version of this habit, so it keeps those fields.
        </p>
      ) : null}
      {!online ? (
        <p role="status" className="rounded-xl bg-lemon/60 px-3 py-2 text-sm">
          You're offline. You can save once you reconnect.
        </p>
      ) : null}
      <HabitEntryForm
        fields={fields}
        notesEnabled={habit.notes_enabled}
        templateKey={habit.template_key}
        defaultValues={defaults}
        defaultNotes={entry?.notes}
        goal={habit}
        disabled={!online}
        submitLabel={entry ? 'Save changes' : 'Save entry'}
        onSubmit={handleSubmit}
        footer={
          entry ? (
            <ConfirmDialog
              open={confirmDelete}
              onOpenChange={setConfirmDelete}
              title="Delete this entry?"
              description={`Your ${habit.name} entry for ${dayPhrase(date)} will be removed. You can record it again any time.`}
              confirmLabel="Delete entry"
              onConfirm={handleDelete}
              trigger={
                <Button type="button" variant="destructive" className="h-12 w-full" disabled={!online || deleteEntry.isPending}>
                  <Trash2 className="size-4" /> {deleteEntry.isPending ? 'Deleting…' : 'Delete entry'}
                </Button>
              }
            />
          ) : null
        }
      />
    </div>
  )
}
