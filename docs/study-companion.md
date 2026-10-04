# Study companion V1 rollout notes

The study companion is part of the authenticated `/app` shell. Each student names
their own companion. Preferences and reminders are private Supabase rows; the
short day-plan proposal writes to Planner only after the student selects
**Apply plan**. The migration is additive and does not change existing rows or
policies.

## Before rollout

1. Review `supabase/migrations/20261004100000_study_companion_v1.sql` against the
   linked project's actual migration history. Keep the existing project and
   data. Run `npx supabase migration list --linked` and
   `npx supabase db push --linked --dry-run`; inspect the exact pending list.
2. Only after the migration chain is confirmed, apply it through the normal
   `npx supabase db push --linked` workflow. Do not reset or repair migration
   history to force a match. Verify both new tables have RLS, owner policies,
   and authenticated grants; verify anonymous access fails. Verify the public
   plan RPC and reminder-claim RPC are `SECURITY INVOKER`. The privileged plan
   implementation lives in the unexposed `companion_private` schema, which must
   not be added to Data API exposed schemas. Authenticated users receive only
   `USAGE` on that dedicated schema and `EXECUTE` on its one implementation
   function; they receive no private-table access.
3. Validate naming, one-session greeting, owner isolation, a confirmed
   reminder, its due in-app notice, a confirmed day plan, and a replayed plan
   request with an isolated account before a separate application deployment.

The existing server-only `GEMINI_API_KEY` and `FOCUSLY_AI_PLANNER_MODEL` configure
the companion's optional natural-language replies. No new Vercel variable or
provider key is required. Neither value belongs in `NEXT_PUBLIC_*`. Deterministic
greetings, study suggestions, and day-plan previews do not call Gemini.

Reminders are checked while an authenticated Focusly page is open. An in-app
notice works without browser notification permission. The optional browser
notification uses an existing granted permission or asks after the student saves
a reminder. Closed-app delivery needs a future scheduled push-delivery service;
the existing PWA service worker alone cannot schedule these database reminders.
No background delivery is promised by V1.

The migration and UI have local automated coverage, including PostgreSQL/RLS
assertions. They have not been applied to hosted Supabase or deployed by this
implementation task.
