import { GlassCard } from '@/components/common/glass-card'
import { NestLogo } from '@/components/common/nest-logo'

/** Centered card used by sign-in / sign-up / password screens. */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100dvh-2rem)] flex-col justify-center py-8">
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <NestLogo className="size-16" />
        <p className="text-3xl font-extrabold tracking-tight">HabitNest</p>
      </div>
      <GlassCard className="space-y-5 p-6">
        <div className="space-y-1">
          <h1 className="text-xl font-bold">{title}</h1>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {children}
      </GlassCard>
    </div>
  )
}
