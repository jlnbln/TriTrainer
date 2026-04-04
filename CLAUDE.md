@AGENTS.md

# TriTrainer — Project Context

## What This Is
A mobile-first triathlon training PWA for Julian's sprint triathlon on **September 6, 2026** (1km Swim, 20km Bike, 5km Run). Hosted on Vercel. Single-user app protected by Supabase auth.

## Tech Stack
- **Next.js 16** (App Router, Turbopack) — see AGENTS.md for breaking changes
- **Tailwind CSS v4** + **shadcn/ui**
- **Supabase** — PostgreSQL + Auth + Storage (RLS enabled on all tables)
- **Tanstack Query** — client-side cache and mutations
- **next-themes** — light/dark/auto theme (`'system'` in next-themes = `'auto'` in DB)
- **OpenRouter API** — LLM chat via `anthropic/claude-sonnet-4`, proxied through `/api/chat`

## Key Conventions
- All app pages live in `src/app/(app)/` and are `force-dynamic` (require Supabase auth)
- Login page is in `src/app/login/` with its own layout that sets `force-dynamic`
- Server components use `src/lib/supabase/server.ts`, client components use `src/lib/supabase/client.ts`
- Middleware at `src/middleware.ts` protects all routes except `/login` and static assets
- Sport colors defined in `src/lib/constants.ts` — always use these, never hardcode colors
- Training data is seeded via `scripts/seed-database.ts` from `scripts/training-data.json`

## Database Tables
- `phases` — 4 training phases (public read)
- `weeks` — 22 weeks linked to phases (public read)
- `trainings` — 154 sessions with `drill_slugs[]`, `is_modified`, `original_description` (public read, auth update)
- `drills` — 6 swim drill explanations (public read)
- `completions` — RLS: user sees/writes own only
- `profiles` — RLS: user sees/writes own only; theme stored as `'light'|'dark'|'auto'`
- `gear` — running shoes; wear % = `total_run_km / max_distance_km * 100`
- `chat_messages` — RLS: user sees/writes own only

## Sport Types
`swim` | `run` | `bike` | `brick` | `rest` | `race`

## Training Data
- 22 weeks, Apr 6 – Sep 6, 2026
- 154 total sessions (43 swim, 43 run, 15 bike, 6 brick, 46 rest, 1 race)
- 6 swim drills: `catch-up`, `finger-drag`, `side-kick`, `single-arm`, `fist`, `open-water-sighting`
- Race day is Sep 6, 2026 (Sunday), week 22, day index 6

## Design System (from Google Stitch)
- **Fonts**: `Lexend` (headlines/labels, CSS var `--font-headline`) + `Plus Jakarta Sans` (body, `--font-body`)
- **Material Symbols** icon font loaded via CDN link in layout — use `<span className="material-symbols-outlined">icon_name</span>`
- **Dark theme colors**: background `#0c1322`, primary `#adc6ff`, secondary `#4ae176`, tertiary `#ffb690`
- **Sport CSS vars**: `var(--sport-swim/run/bike/brick/rest/race)` — use these, never hardcode sport colors
- **Sport discipline bars**: use `sport-bar-{sport}` CSS class for the colored left strip on cards
- **Card pattern**: `bg-card rounded-2xl border border-border/40` with `sport-bar-{sport}` left strip
- **Header**: fixed frosted glass (`dark:glass`), italic bold `TriTrainer` logo in primary color
- **Bottom nav**: frosted glass, Material Symbols icons with `FILL 1` when active, Lexend uppercase labels
- **Buttons**: gradient `from-secondary to-emerald-500` (primary CTA), border destructive (sign out)
- `app-header.tsx` is the shared top header — rendered in `(app)/layout.tsx`

## Known Gotchas
- `next-themes` `useTheme()` returns `undefined` on server — always guard with a `mounted` state before using `theme` in render
- Date calculations use `T12:00:00Z` noon UTC to avoid timezone off-by-one errors
- The middleware deprecation warning ("use proxy instead") is a Next.js 16 issue — ignore it, it still works
- `Shoe` icon doesn't exist in lucide-react — use `Footprints` instead
