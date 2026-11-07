/**
 * Central TanStack Query keys. Every feature uses these so invalidation stays consistent.
 * Invalidate a prefix (e.g. queryKeys.habits.all) to refresh everything beneath it.
 */
export const queryKeys = {
  auth: { session: ['auth', 'session'] as const },
  profile: {
    me: ['profile', 'me'] as const,
    family: ['profile', 'family'] as const, // profiles of family members (incl. me)
  },
  settings: { me: ['settings', 'me'] as const },
  habits: {
    all: ['habits'] as const,
    list: (includeArchived = false) => ['habits', 'list', { includeArchived }] as const,
    detail: (id: string) => ['habits', 'detail', id] as const,
    fields: (habitId: string) => ['habits', 'fields', habitId] as const, // all versions
    streaks: ['habits', 'streaks'] as const,
    shared: ['habits', 'shared'] as const, // family members' shared habits
  },
  entries: {
    all: ['entries'] as const,
    byDate: (date: string) => ['entries', 'date', date] as const,
    range: (start: string, end: string, habitId?: string) => ['entries', 'range', start, end, habitId ?? 'all'] as const,
  },
  schedules: { all: ['schedules'] as const, byDay: (day: number) => ['schedules', 'day', day] as const },
  family: {
    all: ['family'] as const,
    mine: ['family', 'mine'] as const,
    invitations: ['family', 'invitations'] as const,
    invitePreview: (code: string) => ['family', 'invite-preview', code] as const,
    leaderboard: (start: string, end: string) => ['family', 'leaderboard', start, end] as const,
    metrics: (start: string, end: string) => ['family', 'metrics', start, end] as const,
  },
  challenges: {
    all: ['challenges'] as const,
    list: ['challenges', 'list'] as const,
    detail: (id: string) => ['challenges', 'detail', id] as const,
    progress: (id: string) => ['challenges', 'progress', id] as const,
  },
  achievements: {
    all: ['achievements'] as const,
    catalogue: ['achievements', 'catalogue'] as const,
    forUser: (userId: string) => ['achievements', 'user', userId] as const,
  },
  notifications: { all: ['notifications'] as const },
  push: { subscriptions: ['push', 'subscriptions'] as const },
  passkeys: { all: ['passkeys'] as const },
} as const
