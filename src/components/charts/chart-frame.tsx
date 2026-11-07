import { useId } from 'react'
import { GlassCard } from '@/components/common/glass-card'
import { cn } from '@/lib/utils'

export type DataTableColumn = { key: string; label: string }
export type DataTableRow = { id: string; cells: Record<string, string> }

/** Card shell for charts: heading, optional action, the (visual) chart and a screen-reader data table. */
export function ChartFrame({
  title,
  description,
  action,
  summary,
  table,
  children,
  className,
}: {
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  /** One-sentence text summary read by screen readers. */
  summary?: string
  table?: { columns: DataTableColumn[]; rows: DataTableRow[] }
  children: React.ReactNode
  className?: string
}) {
  const titleId = useId()
  return (
    <GlassCard as="section" aria-labelledby={titleId} className={cn('space-y-3', className)}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 id={titleId} className="font-bold leading-tight">
            {title}
          </h3>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {summary ? <p className="sr-only">{summary}</p> : null}
      <div aria-hidden="true">{children}</div>
      {table ? <ChartDataTable caption={title} {...table} /> : null}
    </GlassCard>
  )
}

/** Visually hidden table so the chart's numbers are available to assistive technology. */
export function ChartDataTable({
  caption,
  columns,
  rows,
}: {
  caption: string
  columns: DataTableColumn[]
  rows: DataTableRow[]
}) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.key} scope="col">
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            {columns.map((c, i) =>
              i === 0 ? (
                <th key={c.key} scope="row">
                  {r.cells[c.key]}
                </th>
              ) : (
                <td key={c.key}>{r.cells[c.key]}</td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
