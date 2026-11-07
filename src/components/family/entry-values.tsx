import { CheckCircle2, Circle, StickyNote } from 'lucide-react'
import { friendlyDay } from '@/lib/dates'
import { formatNumber } from '@/domain/challenge'
import type { FieldDefinition, HabitEntry, Json } from '@/types/models'

function asRecord(values: Json): Record<string, Json | undefined> {
  return values && typeof values === 'object' && !Array.isArray(values) ? values : {}
}

function formatValue(def: FieldDefinition, raw: Json | undefined): string | null {
  if (raw === null || raw === undefined || raw === '') return null
  if (def.field_type === 'number') {
    const n = typeof raw === 'number' ? raw : Number(raw)
    if (!Number.isFinite(n)) return null
    return def.unit ? `${formatNumber(n)} ${def.unit}` : formatNumber(n)
  }
  return typeof raw === 'string' ? raw : String(raw)
}

/**
 * One habit entry rendered with the field definitions of *its own* habit_version,
 * so older entries keep their original labels and units.
 */
export function EntryValues({ entry, definitions }: { entry: HabitEntry; definitions: FieldDefinition[] }) {
  const defs = definitions
    .filter((d) => d.habit_id === entry.habit_id && d.version === entry.habit_version)
    .sort((a, b) => a.sort_order - b.sort_order)
  const values = asRecord(entry.field_values)
  const rows = defs
    .map((d) => ({ def: d, text: formatValue(d, values[d.field_key]) }))
    .filter((r): r is { def: FieldDefinition; text: string } => r.text !== null)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{friendlyDay(entry.entry_date)}</span>
        {entry.is_complete ? (
          <span className="flex items-center gap-1 text-xs font-semibold text-success">
            <CheckCircle2 className="size-3.5" aria-hidden /> Done
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Circle className="size-3.5" aria-hidden /> Logged
          </span>
        )}
      </div>
      {rows.length ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
          {rows.map(({ def, text }) => (
            <div key={def.id} className="contents">
              <dt className="text-muted-foreground">{def.label}</dt>
              <dd className="min-w-0 break-words font-medium">{text}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {entry.notes ? (
        <p className="flex gap-1.5 rounded-xl bg-lemon/30 p-2 text-sm">
          <StickyNote className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 break-words">{entry.notes}</span>
        </p>
      ) : null}
    </div>
  )
}
