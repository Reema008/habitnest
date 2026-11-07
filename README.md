# HabitNest

A family habit-tracking Progressive Web App. Each family member has their own profile, tracks daily habits
(built-in or fully custom), plans a personal schedule, and can choose — habit by habit — what to share with
their family for friendly comparisons, a leaderboard and family challenges. A small, optional virtual pet keeps
you company.

Live app (after deployment): **https://reema008.github.io/habitnest/**

---

## Features

- **Accounts without email** – sign up with a *username* and password. No email is ever sent.
  - **Fingerprint / Face ID sign-in** with passkeys (Supabase native WebAuthn).
  - **Family-admin password reset** with a forced password change at next sign-in.
- **Families** – create a family, invite members with a code or link (expiring, limited uses, revocable),
  admin/member roles, remove members, leave a family. One family per user.
- **Profiles** – display name, photo upload or preset avatar, badges, pet.
- **Daily schedule** – a personal weekly timeline (add / edit / delete, start & end times, descriptions).
- **Default habits** – Sleep (h), Exercise (h), Walking (steps), Junk Food (yes/no + notes), Water (L).
  Decimals supported; all editable and deletable.
- **Custom habits** – unlimited habits with up to 12 fields each: number, text, radio buttons, dropdown.
  Labels, units, options, required flag, validation (min / max / whole numbers / max length), display order,
  optional notes, goals, weekly frequency, icon and colour. Preview before saving.
- **Versioned habit definitions** – editing fields creates a new version; past entries always render with
  the fields they were recorded with.
- **Per-habit privacy** – *Private* (default) or *Shared with family*, enforced by Postgres Row Level Security.
- **Daily tracking** – date navigation, one entry per habit per day, edit and delete with confirmation,
  completion indicators.
- **Reports** – weekly, monthly and custom ranges, per-habit or all habits, personal or family scope.
  Line and bar charts, distributions, a calendar heatmap, progress rings and summary cards. Units are never mixed.
- **Family comparison & leaderboard** – compares only compatible shared metrics (same metric and unit) and
  ranks by consistency on shared habits only, with encouraging wording.
- **Streaks & badges** – streaks count only scheduled days. Badges are server-awarded and never taken away.
- **Family challenges** – total-amount or days-completed challenges with a target and dates. Members join
  with one of their *shared* habits; progress bars and results.
- **Virtual pet (minimal)** – choose a Kawaii Kitty, Baby Bunny, Teddy Bear, Baby Dinosaur or Baby Axolotl.
  It greets you, blinks, waves, bounces and nods, and there is one mini-game, *Star Catch*. It has no care
  mechanics and is never affected by habits.
- **Reminders** – optional daily and "still incomplete" Web Push reminders at your local time, with no duplicates.
- **PWA** – installable, works offline for viewing cached data, update prompt, light / dark / system theme.

## Tech stack

| Area | Choice |
|---|---|
| App | React 19, TypeScript (strict), Vite, React Router |
| UI | Tailwind CSS v4, shadcn/ui (Radix), lucide icons, Motion, Recharts (shadcn charts) |
| Data | TanStack Query (persisted cache), Zustand, react-hook-form + zod |
| PWA | vite-plugin-pwa (Workbox, custom service worker with push) |
| Backend | Supabase: Postgres + RLS, Auth (password + passkeys), Storage, Edge Functions (Deno), pg_cron + pg_net, Vault |
| Tests | Vitest + Testing Library, embedded Postgres (real PG 18) for database/RLS tests |
| Hosting | GitHub Pages via GitHub Actions |

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for layers and conventions.

## Project structure

```
src/
  api/            data access (the only code that talks to Supabase)
  hooks/          TanStack Query hooks
  domain/         pure, unit-tested logic (validation schemas, reports, streak helpers, games…)
  components/     ui/ (shadcn), common/, habits/, charts/, reports/, family/, pet/, profile/, schedule/, settings/, pwa/
  routes/         screens, one folder per feature (each renders nested routes)
  lib/ providers/ store/ types/
  sw.ts           service worker (precache, offline navigation, push)
supabase/
  migrations/     schema, RLS, triggers, RPCs, reporting, storage, reminders, grants
  functions/      Edge Functions: send-reminders, admin-reset-password
tests/
  db/             RLS / privacy / data-integrity tests on embedded Postgres
scripts/          gen-db-types.ts (generates src/types/database.ts)
.github/workflows deploy.yml (GitHub Pages), ci.yml
```

## Getting started

### Prerequisites
- Node.js 24+ and npm
- A Supabase project (the free tier is fine)

### 1. Install
```bash
npm install
cp .env.example .env   # then fill in the values below
```

### 2. Environment variables (`.env`)

| Variable | Where to find it | Secret? |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | No |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys → *publishable* / anon key | No (protected by RLS) |
| `VITE_VAPID_PUBLIC_KEY` | Generated with `npx web-push generate-vapid-keys` (public half) | No |

Never put the `service_role` / secret key or the VAPID **private** key in `.env` or in the repository.

### 3. Supabase setup
1. **Authentication → Sign In / Providers → Email**: keep Email enabled, **turn "Confirm email" OFF**.
   HabitNest maps usernames to internal, non-deliverable addresses, so no email is ever sent.
2. **Authentication → Passkeys** (for fingerprint sign-in): enable it and set the relying party to
   `reema008.github.io` with origins `https://reema008.github.io` and `http://localhost:5173`.
3. **Database → Extensions**: enable `pg_cron` and `pg_net` (needed for reminders).
4. Apply the migrations in `supabase/migrations/` in filename order. Use any one of:
   - the Supabase MCP / dashboard **SQL Editor** (paste each file in order), or
   - the CLI: `npx supabase link --project-ref <ref>` then `npx supabase db push`.
5. Store the reminder secrets in **Vault** (SQL Editor). The real values are never committed:
   ```sql
   select vault.create_secret('https://<ref>.supabase.co', 'habitnest_project_url');
   select vault.create_secret('<random 32+ chars>',        'habitnest_cron_secret');
   select vault.create_secret('<VAPID public key>',        'habitnest_vapid_public_key');
   select vault.create_secret('<VAPID private key>',       'habitnest_vapid_private_key');
   select vault.create_secret('https://reema008.github.io/habitnest/', 'habitnest_vapid_subject');
   ```
   > The hosted project `vmzuxjaigjossyhsksvz` was set up through the Supabase MCP/SQL Editor, so its
   > migration history uses different version numbers than these files. Before using `supabase db push`
   > there, run `npx supabase migration repair --status applied <version>` for each existing file.
6. Deploy the Edge Functions (`supabase/functions/*`): `npx supabase functions deploy send-reminders` and
   `npx supabase functions deploy admin-reset-password` (or deploy them via the Supabase MCP).

### Row Level Security
RLS is enabled on **every** table. Key rules:
- Users read and modify only their own profile, settings, schedules, habits, entries, notifications and push subscriptions.
- Family members can read each other's profiles. They see another member's habit, fields and entries
  (including notes) **only** when that habit is shared with the family.
- Nobody can modify another user's records. Ownership and computed columns are protected by column-level grants.
- Families, membership changes and invitations go through SECURITY DEFINER RPCs that check roles. Invite codes
  are random, expire, have use limits, can be revoked and are rate-limited against guessing.
- Reports, leaderboard and challenge progress are SECURITY INVOKER functions. RLS filters rows *before*
  aggregation and only shared habits are counted — even for the caller — so private data cannot leak through rankings.
- Badges tied to private habits are hidden from family. Users can never award or remove badges themselves.
- `anon` has no table access at all. It can only check username availability.

## Development

```bash
npm run dev          # http://localhost:5173/habitnest/
npm run typecheck    # TypeScript (strict)
npm run lint         # oxlint
npm test             # unit & component tests (Vitest, jsdom)
npm run test:db      # database / RLS tests on an embedded Postgres (no Docker needed)
npm run db:types     # regenerate src/types/database.ts from the migrations
npm run build        # production build (PWA) into dist/
npm run preview      # serve the production build
```

## Testing
- `npm run test:db` boots a real PostgreSQL 18 (via `embedded-postgres`). It applies a small emulation of
  Supabase's `auth` / `storage` schemas and roles, runs all migrations, and executes the tests as different
  users through the `authenticated` / `anon` roles with JWT claims, exactly like PostgREST requests.
  It covers the required security cases (private vs shared habits, cross-family isolation, no modification
  of others' data, exclusion from comparisons, leaderboards, reports and challenges, API bypass attempts),
  plus invitations, entry validation, versioning, streaks, badges and reminder de-duplication.
- `npm test` runs unit tests for the domain logic and components.

## Build & deploy

### GitHub Pages (automatic)
1. Push to `main` on GitHub (`reema008/habitnest`).
2. In the repository settings, set **Pages → Source: GitHub Actions**.
3. Add **repository variables** (Settings → Secrets and variables → Actions → *Variables*):
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`.
4. The `Deploy` workflow builds the app, copies `index.html` to `404.html` so deep links work, and publishes
   it to `https://reema008.github.io/habitnest/`.

### Manual
```bash
npm run build
# upload dist/ to any static host that serves it under /habitnest/ (or set VITE_BASE_PATH=/ for a root deployment)
```

## Costs
Everything runs on free tiers: Supabase Free, GitHub Pages and Web Push. Free Supabase projects pause after
about a week of inactivity and can be restored from the dashboard.
