# HabitNest architecture & conventions

Mobile-first PWA: **React 19 + Vite + TypeScript (strict) + Tailwind v4 + shadcn/ui**, backed by **Supabase**
(Postgres + Auth + Storage + Edge Functions). Hosted on GitHub Pages under the base path `/habitnest/`.

## Layers

| Layer | Location | Rules |
|---|---|---|
| Database | `supabase/migrations/*.sql` | Source of truth. RLS on every table, privacy enforced here. |
| DB types | `src/types/database.ts` | Generated (`npm run db:types`). Never edit by hand. |
| Domain types | `src/types/models.ts` | Friendly aliases (`Habit`, `HabitWithFields`, `FieldDraft`, …). |
| Data access | `src/api/<domain>.ts` | The *only* place that calls `supabase`. Use `unwrap` / `unwrapMaybe` from `src/lib/errors.ts`. |
| Server state | `src/hooks/use-<domain>.ts` | TanStack Query hooks using keys from `src/lib/query-keys.ts`. Mutations invalidate related keys. |
| Pure logic | `src/domain/*.ts` | No React, no Supabase. Unit-tested in `src/domain/*.test.ts` (Vitest). |
| UI | `src/components/<area>/` | `ui/` = shadcn primitives, `common/` = app-wide building blocks. |
| Screens | `src/routes/<feature>/` | Thin. Each feature's `index.tsx` renders its own nested `<Routes>` (mounted at `/<feature>/*` in `src/App.tsx`). |

## Key building blocks
- `useCurrentUser()` (`src/providers/auth-provider.tsx`) → `{ userId, profile }` inside authenticated routes.
- `GlassCard`, `PageHeader`, `EmptyState`, `ErrorState`, `LoadingState`, `UserAvatar`, `HabitIcon`, `habitColor()`,
  `ConfirmDialog`, `useOnline()` in `src/components/common/`.
- Dates are ISO day strings (`YYYY-MM-DD`) in the user's local time — helpers in `src/lib/dates.ts`.
- Toasts: `import { toast } from 'sonner'`; messages via `toUserMessage(error)`.
- Animation: `import { motion } from 'motion/react'`; respect reduced motion (`useReducedMotion`).
- Charts: shadcn `src/components/ui/chart.tsx` (Recharts). Colours: `var(--chart-1..5)`.

## Data contract highlights
- `habit_entries.field_values` is a JSON object keyed by `field_key`. Insert with `habit_version = habits.current_version`;
  upsert on `(habit_id, entry_date)`. Clients may only write `habit_id, entry_date, habit_version, field_values, notes`.
  The server validates values and computes `is_complete`; its error messages are user-readable.
- Habit fields are versioned. `create_habit(p_habit, p_fields, p_goal)` and `save_habit_fields(p_habit_id, p_fields, p_goal)`
  write definitions; old entries keep rendering with the definitions of *their* `habit_version`.
- Habit metadata (`name, description, icon, color, visibility, notes_enabled, frequency_days, sort_order, archived_at`)
  is updated directly. `frequency_days` uses 0 = Sunday … 6 = Saturday.
- Family data comes only from RLS-filtered tables and SECURITY INVOKER RPCs (`family_leaderboard`,
  `family_metric_series`, `challenge_progress`) that include **shared** habits only.

## UX rules
- Mobile first (360–430 px), 44 px touch targets, labelled controls, visible focus, light + dark themes.
- Never shame users for missed days; copy is encouraging. No fake/placeholder data, no dead buttons.
- Disable writes while offline (`useOnline()`), show loading / empty / error states everywhere.
- Every habit shows whether it is **Private** or **Shared with family**.
