import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import {
  Bell, CalendarClock, ChartColumn, CheckCircle2, ChevronRight, Circle, CircleDot, Flame, ListChecks, Plus, Settings,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/common/glass-card'
import { HABIT_ICONS, HabitIcon } from '@/components/common/habit-visuals'
import { ErrorState, LoadingState } from '@/components/common/states'
import { UserAvatar } from '@/components/common/user-avatar'
import { ProgressRing } from '@/components/charts/progress-ring'
import { ActiveChallengesCard } from '@/components/family/active-challenges-card'
import { HabitEntrySheet } from '@/components/habits/habit-entry-sheet'
import { PrivacyBadge } from '@/components/habits/privacy-badge'
import { PetGreeting } from '@/components/pet/pet-greeting'
import { InstallPrompt } from '@/components/pwa/install-prompt'
import { formatTimeLabel, minutesSinceMidnight, parseTime, sortSchedule } from '@/domain/schedule'
import { useUserBadges } from '@/hooks/use-achievements'
import { useEntriesForDate } from '@/hooks/use-entries'
import { useMyFamily } from '@/hooks/use-family'
import { useActiveHabits, useHabitStreaks } from '@/hooks/use-habits'
import { useUnreadCount } from '@/hooks/use-notifications'
import { useDaySchedule } from '@/hooks/use-schedules'
import { dayOfWeek, formatDay, todayISO } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { useCurrentUser } from '@/providers/auth-provider'
import type { HabitEntry, HabitWithFields } from '@/types/models'

function greeting(date = new Date()): string {
  const h = date.getHours()
  if (h < 5) return 'Good night'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

/** Home: welcome, pet, today's habits, quick links, schedule, streaks, badges, family. */
export default function DashboardPage() {
  const { userId, profile } = useCurrentUser()
  const today = todayISO()
  const unread = useUnreadCount()

  return (
    <div className="space-y-4 pb-4">
      <header className="flex items-center gap-3 pt-2">
        <Link to="/profile" aria-label="Your profile" className="rounded-full focus-visible:outline-2 focus-visible:outline-ring">
          <UserAvatar profile={profile} className="size-12 text-xl" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">{formatDay(today, 'EEEE, d MMMM')}</p>
          <h1 className="truncate text-2xl font-extrabold tracking-tight">
            {greeting()}, {profile.display_name}
          </h1>
        </div>
        <Button asChild variant="ghost" size="icon" className="relative size-11 rounded-full">
          <Link to="/notifications" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}>
            <Bell className="size-5" />
            {unread > 0 ? (
              <span className="absolute right-1.5 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {unread > 9 ? '9+' : unread}
              </span>
            ) : null}
          </Link>
        </Button>
        <Button asChild variant="ghost" size="icon" className="size-11 rounded-full">
          <Link to="/settings" aria-label="Settings">
            <Settings className="size-5" />
          </Link>
        </Button>
      </header>

      <PetGreeting />
      <InstallPrompt />
      <TodayOverview today={today} />
      <QuickLinks />
      <TodaySchedule today={today} />
      <StreaksAndBadges userId={userId} />
      <FamilySnapshot />
      <ActiveChallengesCard />
    </div>
  )
}

function TodayOverview({ today }: { today: string }) {
  const habits = useActiveHabits()
  const entries = useEntriesForDate(today)
  const [open, setOpen] = useState<{ habit: HabitWithFields; entry?: HabitEntry } | null>(null)

  const dow = dayOfWeek(today)
  const scheduled = useMemo(() => (habits.data ?? []).filter((h) => h.frequency_days.includes(dow)), [habits.data, dow])
  const entryByHabit = useMemo(() => new Map((entries.data ?? []).map((e) => [e.habit_id, e])), [entries.data])
  const completed = scheduled.filter((h) => entryByHabit.get(h.id)?.is_complete).length
  const recorded = scheduled.filter((h) => entryByHabit.has(h.id)).length
  const pct = scheduled.length ? Math.round((completed / scheduled.length) * 100) : 0
  const sharedCount = (habits.data ?? []).filter((h) => h.visibility === 'family').length

  if (habits.isPending || entries.isPending) return <LoadingState rows={2} />
  if (habits.error) return <ErrorState error={habits.error} onRetry={() => void habits.refetch()} />

  return (
    <GlassCard as="section" aria-labelledby="today-heading" className="space-y-4">
      <div className="flex items-center gap-4">
        <ProgressRing value={pct} size={84} label="Today's completion">
          <span className="text-center leading-tight">
            <span className="block text-xl font-extrabold">{completed}</span>
            <span className="block text-xs text-muted-foreground">of {scheduled.length}</span>
          </span>
        </ProgressRing>
        <div className="min-w-0 flex-1 space-y-1">
          <h2 id="today-heading" className="text-lg font-bold">Today's habits</h2>
          <p className="text-sm text-muted-foreground">
            {scheduled.length === 0
              ? 'Nothing scheduled today — enjoy the breather.'
              : completed === scheduled.length
                ? 'Everything done today. Lovely work!'
                : recorded > 0
                  ? `${recorded} recorded so far — every bit counts.`
                  : 'A fresh day. Start with whichever feels easiest.'}
          </p>
          <p className="text-xs text-muted-foreground">
            {sharedCount} of {habits.data?.length ?? 0} habits shared with family · the rest are private
          </p>
        </div>
      </div>

      {scheduled.length > 0 ? (
        <ul className="space-y-2">
          {scheduled.map((h) => {
            const entry = entryByHabit.get(h.id)
            const state = entry?.is_complete ? 'done' : entry ? 'recorded' : 'todo'
            return (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => setOpen({ habit: h, entry })}
                  className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-glass/60 px-3 py-2 text-left transition hover:bg-lavender/30 focus-visible:outline-2 focus-visible:outline-ring"
                  aria-label={`${h.name}: ${state === 'done' ? 'complete' : state === 'recorded' ? 'recorded' : 'not recorded yet'}. Tap to ${entry ? 'edit' : 'record'}.`}
                >
                  <HabitIcon icon={h.icon} color={h.color} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{h.name}</span>
                    <PrivacyBadge visibility={h.visibility} className="mt-0.5" />
                  </span>
                  {state === 'done' ? (
                    <CheckCircle2 className="size-6 text-success" aria-hidden />
                  ) : state === 'recorded' ? (
                    <CircleDot className="size-6 text-primary" aria-hidden />
                  ) : (
                    <Circle className="size-6 text-muted-foreground" aria-hidden />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      ) : (habits.data?.length ?? 0) === 0 ? (
        <Button asChild className="w-full">
          <Link to="/habits/new">
            <Plus className="size-4" /> Create your first habit
          </Link>
        </Button>
      ) : null}

      <Button asChild variant="secondary" className="h-11 w-full">
        <Link to="/track">
          Open today's tracker <ChevronRight className="size-4" />
        </Link>
      </Button>

      {open ? (
        <HabitEntrySheet
          habit={open.habit}
          date={today}
          entry={open.entry}
          open
          onOpenChange={(o) => {
            if (!o) setOpen(null)
          }}
        />
      ) : null}
    </GlassCard>
  )
}

function QuickLinks() {
  const links = [
    { to: '/habits', label: 'Habits', icon: ListChecks, tone: 'bg-lavender' },
    { to: '/reports', label: 'Reports', icon: ChartColumn, tone: 'bg-sky' },
    { to: '/schedule', label: 'Schedule', icon: CalendarClock, tone: 'bg-peach' },
    { to: '/family', label: 'Family', icon: Users, tone: 'bg-mint' },
  ] as const
  return (
    <nav aria-label="Quick access" className="grid grid-cols-4 gap-2">
      {links.map(({ to, label, icon: Icon, tone }) => (
        <Link
          key={to}
          to={to}
          className="glass flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl text-xs font-semibold focus-visible:outline-2 focus-visible:outline-ring"
        >
          <span className={cn('flex size-9 items-center justify-center rounded-xl', tone)}>
            <Icon className="size-5 text-foreground/80" aria-hidden />
          </span>
          {label}
        </Link>
      ))}
    </nav>
  )
}

function TodaySchedule({ today }: { today: string }) {
  const schedule = useDaySchedule(dayOfWeek(today))
  const items = useMemo(() => sortSchedule(schedule.data ?? []), [schedule.data])
  const [now] = useState(() => minutesSinceMidnight(new Date()))
  const upcoming = items.filter((i) => (parseTime(i.end_time) ?? 0) > now).slice(0, 3)

  if (schedule.isPending || schedule.error) return null
  return (
    <GlassCard as="section" aria-labelledby="schedule-heading" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 id="schedule-heading" className="text-lg font-bold">Today's schedule</h2>
        <Link to="/schedule" className="text-sm font-semibold text-primary">
          View all
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No plans yet for today.{' '}
          <Link to="/schedule" className="font-semibold text-primary">
            Add something
          </Link>
        </p>
      ) : upcoming.length === 0 ? (
        <p className="text-sm text-muted-foreground">That's everything planned for today.</p>
      ) : (
        <ul className="space-y-2">
          {upcoming.map((i) => (
            <li key={i.id} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                {formatTimeLabel(i.start_time)} – {formatTimeLabel(i.end_time)}
              </span>
              <span className="truncate font-medium">{i.title}</span>
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  )
}

function StreaksAndBadges({ userId }: { userId: string }) {
  const habits = useActiveHabits()
  const ids = useMemo(() => (habits.data ?? []).map((h) => h.id), [habits.data])
  const streaks = useHabitStreaks(ids)
  const badges = useUserBadges(userId)

  const top = useMemo(
    () =>
      (habits.data ?? [])
        .map((h) => ({ habit: h, streak: streaks.data[h.id]?.current ?? 0 }))
        .filter((s) => s.streak > 0)
        .sort((a, b) => b.streak - a.streak)
        .slice(0, 3),
    [habits.data, streaks.data],
  )
  const recent = (badges.data ?? []).slice(0, 4)

  return (
    <div className="grid grid-cols-2 gap-3">
      <GlassCard as="section" aria-labelledby="streaks-heading" className="space-y-2">
        <h2 id="streaks-heading" className="flex items-center gap-1.5 font-bold">
          <Flame className="size-4 text-peach" aria-hidden /> Streaks
        </h2>
        {top.length === 0 ? (
          <p className="text-sm text-muted-foreground">Complete a habit to start a streak.</p>
        ) : (
          <ul className="space-y-1.5">
            {top.map(({ habit, streak }) => (
              <li key={habit.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{habit.name}</span>
                <span className="shrink-0 font-bold tabular-nums">
                  {streak} {streak === 1 ? 'day' : 'days'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
      <GlassCard as="section" aria-labelledby="badges-heading" className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 id="badges-heading" className="font-bold">Badges</h2>
          <Link to="/profile" className="text-xs font-semibold text-primary">
            See all
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">Your first badge is one entry away.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {recent.map((b) => {
              const Icon = HABIT_ICONS[b.achievement.icon] ?? Flame
              return (
                <li key={b.id} title={b.achievement.name} className="flex size-10 items-center justify-center rounded-xl bg-lemon">
                  <Icon className="size-5 text-foreground/80" aria-label={b.achievement.name} />
                </li>
              )
            })}
          </ul>
        )}
      </GlassCard>
    </div>
  )
}

function FamilySnapshot() {
  const family = useMyFamily()
  if (family.isPending || family.error) return null
  if (!family.data) {
    return (
      <GlassCard as="section" className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-mint">
          <Users className="size-5" aria-hidden />
        </span>
        <p className="flex-1 text-sm">Track together — create a family or join one with an invite code.</p>
        <Button asChild size="sm">
          <Link to="/family">Set up</Link>
        </Button>
      </GlassCard>
    )
  }
  const { family: fam, members } = family.data
  return (
    <GlassCard as="section" aria-labelledby="family-heading" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 id="family-heading" className="text-lg font-bold">{fam.name}</h2>
        <Link to="/family/leaderboard" className="text-sm font-semibold text-primary">
          Leaderboard
        </Link>
      </div>
      <ul className="flex flex-wrap gap-3">
        {members.map((m) => (
          <li key={m.user_id}>
            <Link to={`/family/members/${m.user_id}`} className="flex w-16 flex-col items-center gap-1 text-center">
              <UserAvatar profile={m.profile} className="size-12" />
              <span className="w-full truncate text-xs font-medium">{m.profile.display_name}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Button asChild variant="secondary" className="h-11 w-full">
        <Link to="/family/compare">Compare shared habits</Link>
      </Button>
    </GlassCard>
  )
}
