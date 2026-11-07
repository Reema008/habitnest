import type { LucideIcon } from 'lucide-react'
import { GlassCard } from '@/components/common/glass-card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

/** A titled card on the Settings page. `id` is used for in-page navigation. */
export function SettingsSection({
  id,
  title,
  description,
  icon: Icon,
  children,
  className,
}: {
  id: string
  title: string
  description?: React.ReactNode
  icon: LucideIcon
  children: React.ReactNode
  className?: string
}) {
  return (
    <GlassCard as="section" id={id} aria-labelledby={`${id}-title`} className={cn('scroll-mt-4 space-y-4', className)}>
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lavender/60">
          <Icon className="size-5 text-primary" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="text-lg font-bold leading-tight">
            {title}
          </h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      {children}
    </GlassCard>
  )
}

/** Label + description + switch row; the whole label is a large tap target. */
export function SwitchRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  id: string
  label: React.ReactNode
  description?: React.ReactNode
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex min-h-14 items-center gap-3">
      <div className="min-w-0 flex-1">
        <Label htmlFor={id} className="block cursor-pointer py-1 text-base font-semibold leading-snug">
          {label}
        </Label>
        {description ? (
          <p id={`${id}-description`} className="text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-describedby={description ? `${id}-description` : undefined}
        className="scale-125"
      />
    </div>
  )
}
