# Focusly

## Daily tasks (pending local migration)

`tasks.task_date` is the stable calendar day shared by Today, the dashboard, Focus task picker, Weekly Planner, and Calendar. The new migration `20261001010000_daily_task_date.sql` is additive and has **not** been applied to the hosted project. Deploy it only after reviewing hosted migration history and data; deploy the corresponding application code afterward. Existing date-only tasks keep `due_on`. Timed legacy tasks are assigned the day of `due_at` in the user's saved timezone at migration time. Previously undated tasks fall back to the day of `created_at` in that timezone, or UTC if no saved timezone exists. This backfill runs once and never moves historical tasks when settings change. The migration preserves existing scheduling fields, status, subjects, notes, timestamps, and reward receipts; a compatibility trigger assigns dates for writes from the currently deployed app during rollout.

Focusly is a bilingual study-planning application built with Next.js, TypeScript, Tailwind CSS, and Supabase.

The existing Supabase project was reconciled on 14 September 2026. Phase 1/2 migrations and the legacy-data import are deployed, with the original user/profile/preferences preserved. Phase 3 Subjects, Tasks, Planner, Calendar and Home are implemented and live-tested. Phase 4 adds the persisted Focus timer, study-progress aggregation, streaks, statistics, goal tracking and the final dashboard. See `outputs/Focusly-Phase-4-Report.md` for current results, and `supabase/reconciliation/README.md` for the preserved history.

For this reconciled remote project, read `supabase/reconciliation/remote-history.json` before any CLI migration push: Supabase MCP assigned remote deployment versions that differ from the unchanged historical source filenames. The setup instructions below describe fresh installations; do not reapply the original migrations to the reconciled project.

## Stable production release — focusly-v1.0-stable

Production: https://focusly-beige.vercel.app

Release checkpoint: 21 September 2026. The owner manually verified production as working correctly. Vercel deployment `dpl_8XJgvm7Wj8xqPxqBXfDe9GCfdiar` is Ready and serves the existing production URL. All 94 uploaded source files matched local SHA-1 content hashes before the release documentation update. Application code and build configuration are unchanged; this checkpoint adds documentation and Git metadata only.

Stable production functionality:

- Email/password signup and login, email confirmation, and password recovery/reset through `/auth/confirm` and `/auth/callback`.
- Egyptian education-system onboarding and education editing in Profile/Settings.
- Persisted accent personalization and Light/Dark/System themes.
- Subjects, tasks, weekly planner, calendar, persisted focus timer, and statistics.
- Profile/Settings, Arabic/English with RTL/LTR, and responsive desktop/mobile layouts.
- Existing Supabase Auth/Postgres backend with ownership-based RLS and cross-user isolation.

`SITE_URL` is `https://focusly-beige.vercel.app`. No Supabase, Vercel, SMTP, user, or data changes were made for this checkpoint. No redeployment was needed.

Final checkpoint validation: TypeScript passed; ESLint passed with zero warnings; all 20 automated tests passed; production build passed. These local tests do not send emails or create hosted users. The preceding backend readiness run passed 106 hosted rollback assertions; it was not rerun against production for this release checkpoint. Historical phase notes below describe implementation history rather than outstanding release work.

The repository was initialized locally for this checkpoint because the existing project had no Git history. The annotated tag `focusly-v1.0-stable` identifies the initial stable commit. No remote repository is configured or pushed by this task.

## Local setup

1. Use Node.js 22 or newer.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env.local` and add the Project URL and publishable key from the Supabase Connect dialog.
4. Run `npm run dev`.

The public pages build without credentials. Authentication forms show a friendly connection error until the environment is configured; no backend success is simulated. Protected routes never return student data without a verified session.

## Phase 2: authentication and onboarding

Routes: `/`, `/login`, `/signup`, `/onboarding`, and the protected `/app` workspace.

1. For a fresh database, apply migrations in `supabase/migrations` in filename order. The connected project already has these migrations; consult its remote-history mapping before using CLI push. Do not reapply them.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`. The template values are intentionally rejected. Use a publishable key, never a secret/service-role key.
3. In Supabase Authentication → Providers → Email, set **Confirm email = ON**. SMTP is managed externally; never put SMTP credentials in this repository.
4. Enable the email provider and email/password sign-up. Set minimum password length to at least 8. Keep anonymous and SMS sign-in disabled. There is no passwordless login UI or `signInWithOtp` call.
5. Signup opens `/confirm-email` with a masked destination, a 60-second resend cooldown, and a confirmation check. The token-hash confirmation link establishes a server-verified session and opens onboarding immediately, or `/app` for an already-onboarded account. Existing accounts remain valid.
6. `/forgot-password` sends a recovery email; `/reset-password` requires a server-verified session and updates the password through Supabase. `/auth/confirm` accepts signup/email and recovery token hashes; `/auth/callback` exchanges PKCE codes. Neither accepts an arbitrary redirect destination.
7. Restart Next.js after changing environment variables.

Auth passwords are only passed to Supabase Auth. The name is passed as initial registration metadata for the database provisioning trigger; `profiles.display_name` is the canonical editable name. Auth metadata is never used for authorization. Existing users created before Phase 2 can enter their name in onboarding.

`getUser()` verifies identity on the server. The proxy refreshes session cookies and prevents shared caching; each protected page/action independently checks identity. No private profile or subject data is cached across requests. Failed queries show a friendly service state. Logout invalidates the app route cache and signs out through Supabase.

Each Continue action persists its step in `profiles`. Refreshing or restarting a browser resumes the next saved step. Unsaved edits in the current step are not committed until Continue. Stage/year changes clear incompatible year/subject drafts. Suggested subjects are optional starting points, not a claim about the official curriculum.

Completion locks the profile and atomically persists `user_settings`, inserts missing normalized subject names, then sets `onboarding_completed`. Failure rolls back all changes; retries after completion are no-ops. RLS and cross-owner foreign keys still apply. Draft subjects do not create actual subject rows until completion. Appearance uses the original Phase 1 theme provider/local cache; on authenticated Home, the Supabase settings hydrate that provider.

## Verification

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm test` (Node.js 22.18+ or Node.js 24; uses native TypeScript stripping)
- `npm run test:db -- <absolute-path-to-pglite/dist/index.js>`

The database test uses the real migrations on embedded PostgreSQL, with a minimal `auth.users`/`auth.uid()` platform harness. It checks migration and ownership assertions including education and accent persistence: constraints, durable drafts, atomic rollback, idempotence, focus lifecycle rules, private data on all six tables, forbidden ownership transfer and cross-owner foreign keys. It does **not** test Supabase Auth, email delivery, PostgREST, or actual browser sessions. The isolated test driver used in this workspace is `../work-cache/db-test/node_modules/@electric-sql/pglite/dist/index.js`; it is not an application dependency. On another machine, install `@electric-sql/pglite` in an isolated tools directory and pass its entry point.

The original pgTAP suite remains available via `supabase test db` with a running local Supabase stack (Docker required). Before production use, test signup and email confirmation, onboarding, logout/login, protected routes, appearance persistence, and cross-user isolation.

## Phase 3: study planning

Routes: `/app`, `/app/subjects`, `/app/tasks`, `/app/planner`, `/app/calendar`, `/app/settings`.

`src/features/planning/data.ts` loads authenticated data on the server; `actions.ts` validates mutations and scopes them to the verified user; `logic.ts` owns validation, filtering, dates, recurrence and overlap calculations. The shell, workspace and reusable editors present those results. New strings use `src/features/i18n/phase3.ts`.

Subjects support creation, rename, color, safe archive when referenced, and restore. Tasks support optional subjects, date-only or timed deadlines, priority, completion, editing, deletion and filters. Planner uses Saturday–Friday on desktop and a selected-day layout on mobile. Calendar projects tasks and sessions without a duplicate events table. Home shows real tasks, the next planned session and subjects. Profile/appearance settings persist to Supabase.

Migration `20260914095642_phase3_planning.sql` adds task `due_on`, weekly recurrence/time zone fields, active subject name uniqueness and the invoker-rights safe-removal function. Remote version `20260914150311` was matched against source SQL. Previous migrations and preserved legacy objects are unchanged.

Date-only deadlines remain calendar dates; timed deadlines use instants. Weekly sessions retain their saved IANA zone and wall-clock time; nonexistent DST occurrences are skipped. Editing/deleting a weekly entry affects the entire series. There are no individual-instance edits. Overlap warnings allow an explicit save; two weekly series are compared over 370 days from their later anchor.

The opt-in live harness is `node --env-file=.env.local tests/live-phase3.mjs --run-live`, with a production server running. It creates real temporary Auth users and data, retaining credentials only in ignored `.supabase/phase3-test-accounts.json` for browser testing. Clean up exactly its test-user IDs afterward. Do not use `--reuse` after a successful full run: fixtures already exist.

## Phase 4: focus and progress

Routes: `/app`, `/app/focus`, `/app/statistics`, `/app/more` plus the Phase 3 planning routes.

Focus sessions are persisted in `focus_sessions` through the invoker-rights `focus_transition` RPC. The browser renders from server timestamps, derives elapsed time after throttling or reload, persists pause/resume/finish state, and uses a partial unique index to prevent multiple active sessions per user. Completed sessions shorter than one minute are discarded. Breaks are local UI intervals and never masquerade as study time.

`focus_progress` returns ownership-scoped weekly and all-time aggregates: daily totals, subject totals, current streak, goal progress and recent history. The dashboard and Statistics page consume those real aggregates. Timer preferences and the IANA time zone live in `user_settings`; the browser proposes its time zone once and the user can edit it in Settings.

Migration `20260915100215_phase4_focus_progress.sql` is deployed remotely as `20260915103116`. The source filename remains unchanged; see `supabase/reconciliation/remote-history.json` before any future migration push. The opt-in live harness is `node --env-file=.env.local tests/live-phase4.mjs --run-live --setup` followed by `--run-live`; it creates tagged temporary users and must be cleaned up by exact IDs after a run.

Leaked-password protection remains disabled in the hosted Auth project and is the only security advisor warning. Performance advisor findings are inherited from legacy/public tables and unused planning indexes; no existing data or policies were changed for Phase 4.

## Phase 5A: production-readiness, profile and settings

`/app/profile` now displays the authenticated student’s name, email, education, daily goal, subject count, completed focus time and current streak from Supabase. The profile form validates stage/year combinations against the existing school-year enum and updates only the existing `profiles` row, preserving subjects, tasks, planner entries and focus history.

`/app/settings` is organized into Account, Education, Study, Appearance, Language and Security sections. It reuses `profiles`, `user_settings`, the existing theme and locale providers, the existing study preferences form, logout action. Profile navigation is available from the desktop shell, top bar and mobile More menu. Phase 5A does not add a migration, alter RLS, modify Auth configuration, delete data, or deploy the application. See `outputs/Focusly-Phase-5A-Report.md` for the audit and validation record.

## Commands

- `npm run dev` — local development
- `npm run typecheck` — strict TypeScript validation
- `npm run lint` — ESLint with zero warnings
- `npm run build` — production build

## Project structure

- `src/app` — App Router routes and global styles
- `src/components` — reusable layout, provider, and UI primitives
- `src/features` — product domains such as localization and themes
- `src/lib` — environment validation and infrastructure clients
- `src/types` — shared and generated database types
- `supabase/migrations` — reproducible database schema
- `supabase/tests` — database and RLS verification


Appearance changes preview and save immediately. Updates patch only the selected setting, preserving language, profile, and study preferences. The authenticated shell loads saved preferences into the existing global theme provider.

## Coordinated auth, accent and Egypt education update

Backend readiness update (21 September 2026): the additive education migration is applied to the existing project as `20260921114959_egypt_education`. Its SQL matches the source migration below. Before application, its pending SQL was amended to preserve the deployed client's year-only onboarding and legacy Profile/Settings edits. New education payloads remain strictly validated. Hosted verification passed 106 transaction-rollback assertions; existing row fingerprints, users, grants and policies are unchanged. See `../outputs/Focusly-Backend-Readiness-Report.md`. The frontend/auth changes were subsequently deployed in the stable production release above; the release checkpoint does not change SMTP or hosted Auth settings.

The additive migration 20260920183348_egypt_education.sql adds nullable education_system, academic_branch, academic_track and specialization_subject columns to profiles. Existing school_stage and school_year remain canonical (no duplicate education_stage column). Existing records, subjects, RLS and grants are retained. New profile edits and onboarding validate the full combination. Incomplete legacy profiles get a nonblocking completion prompt in Profile/Settings.

The typed curriculum source is src/features/education/config.ts. Both forms and server validation consume it; the migration's allowed combinations are verified by the database test. Profile subject additions are explicit and transactional, never destructive replacements.

For future releases: review the remote-history mapping; the education migration is already applied and must not be applied again. Configure SITE_URL to the trusted app origin. Production Supabase Auth Site URL is https://focusly-beige.vercel.app. Allow `/auth/confirm`, `/auth/callback`, and `/auth/callback?flow=recovery` on that origin; allow the same paths on http://localhost:3000 for local testing. Keep Confirm email enabled.

Supabase Dashboard → Authentication → Email Templates → Confirm signup: subject `Confirm your Focusly account`; paste [the final HTML template](docs/supabase/confirmation-email.html). It uses `{{ .RedirectTo }}` and `{{ .TokenHash }}` with `type=email`, so the server can verify the link and set SSR cookies. The local CLI copy is `supabase/templates/confirmation.html`; `config.toml` applies it locally only. Set up Custom SMTP with an authenticated sender domain, SPF, DKIM, and DMARC. Disable link tracking on authentication email so the confirmation URL is not rewritten. These measures improve delivery but cannot guarantee inbox placement. No hosted Auth configuration was changed by this update.

Authenticated root HTML now uses Supabase theme/accent/locale before hydration. Appearance updates continue to patch only the changed field. The warm editorial surfaces remain; active navigation, controls, timer, progress/charts and selected calendar dates use semantic accents.

## AI Weekly Planner (local, not deployed)

The Dashboard opens a bilingual planning wizard in a dialog. Generation uses the server-only Google Gemini SDK with structured output. Set `GEMINI_API_KEY` and `FOCUSLY_AI_PLANNER_MODEL` in the server environment to enable it; neither value belongs in a `NEXT_PUBLIC_` variable. Without them, generation reports an unavailable state instead of inventing a plan. The provider response is parsed at runtime and checked against owned subjects, the saved timezone, Saturday–Friday dates, fixed events, existing Planner occurrences, days off, durations, and daily capacity.

Apply `20261003100320_ai_weekly_planner_save.sql` to the target Supabase project **before** deploying this code. Its owner-scoped RPC saves one Task per work item and linked study blocks for scheduled sessions, all in one transaction. It checks live conflicts and makes retries idempotent. No hosted migration or deployment was performed as part of this local implementation. Run `npm run test:ai-planner` and the existing application, progression, database, type, lint, and build checks before rollout.
