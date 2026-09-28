# Challenges rollout gate — 28 September 2026

Read-only inspection of project `lxlpnynpatnsfvvvxwwx` confirmed:

- Hosted history contains 16 migrations, ending at `20260923112224`.
- `public.progression_profiles`, `public.user_challenges`, the challenge evaluator,
  and the challenge progress RPC are absent.
- Eight local Focusly 2 foundation migrations (Progression through Challenges Engine)
  precede the new read-model migration and are not recorded remotely.
- Earlier version differences are documented in `supabase/reconciliation/README.md`
  and `remote-history.json`: MCP assigned deployment timestamps. The exact remote
  filenames do not exist in reachable Git history. Additional remote schedule,
  push, report and privilege migrations also have no files in local migration history.
- CLI migration listing and dry run cannot authenticate in this environment.

The required “only the read-model migration pending” condition cannot be met.
No files were fabricated or historical versions repaired. No remote changes were
made. A future rollout must first audit and authorize deployment of all missing
Focusly 2 prerequisites and prepare an exact, verified deployment history. Do not
use `--include-all` to bypass the mismatch.

Home and Challenges use the read-only server snapshot. With the RPC absent, both
show an unavailable state. Completion feedback shows saved completions when Home
or Challenges receives a refreshed server snapshot. It never evaluates or awards.
Receipts are scoped by user, challenge key and period; localStorage suppresses
repeat banners across page visits, with in-memory fallback when storage is blocked.
Clearing browser storage or using a different browser can show a receipt again.

Normal production Focus/Task actions still do not invoke the local Focusly 2 reward
RPCs. Wiring that trusted reward flow and verifying live completion feedback remain
rollout prerequisites; this local UX work does not claim end-to-end production readiness.
