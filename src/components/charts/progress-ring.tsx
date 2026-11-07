import { cn } from '@/lib/utils'

/** Circular progress (0–100). Pass `children` to replace the centred percentage. */
export function ProgressRing({
  value,
  size = 88,
  strokeWidth = 8,
  label,
  children,
  color = 'var(--primary)',
  className,
}: {
  /** 0–100; values outside are clamped. */
  value: number
  size?: number
  strokeWidth?: number
  /** Accessible name, e.g. "Completion this week". */
  label?: string
  children?: React.ReactNode
  /** Stroke colour (CSS value). */
  color?: string
  className?: string
}) {
  const pct = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0
  const rounded = Math.round(pct)
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - pct / 100)
  return (
    <div
      role="img"
      aria-label={label ? `${label}: ${rounded}%` : `${rounded}%`}
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--muted)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700 motion-safe:ease-out"
          opacity={pct === 0 ? 0 : 1}
        />
      </svg>
      <span aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center text-center leading-tight">
        {children ?? <span className="font-extrabold tabular-nums" style={{ fontSize: Math.max(11, size * 0.22) }}>{rounded}%</span>}
      </span>
    </div>
  )
}
