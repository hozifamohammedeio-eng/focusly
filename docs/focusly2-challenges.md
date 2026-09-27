# Local Daily and Weekly Challenges Engine

This is local infrastructure only. No active routes import the challenges data
module, no hosted migration has been applied, and no Challenges UI is included.

## Catalog and rewards

| Key | Requirement | Reward |
| --- | --- | --- |
| daily_focus_25 | 25 accepted Focus minutes | 50 XP, 10 Coins |
| daily_tasks_2 | 2 accepted completed tasks | 50 XP, 10 Coins |
| weekly_focus_180 | 180 accepted Focus minutes | 150 XP, 30 Coins |
| weekly_subjects_2 | Accepted study activity in 2 owned subjects | 150 XP, 30 Coins |

All four are assigned deterministically. Rewards reuse progression/rewards.ts;
there are no challenge Construction Points. SQL is authoritative. Tests compare
the SQL catalog with the TypeScript definitions and existing reward values.

## Clock, assignment and evidence

The evaluator uses user_settings.time_zone, falling back to UTC like focus_progress.
Daily windows run from local midnight to the next local midnight. Weekly windows
run Saturday through Friday, matching planning/logic.ts and focus_progress.
Both boundaries are converted separately into timestamptz, preserving DST.
Windows are half-open: starts_at <= activity time < ends_at.

Assignments snapshot time zone and boundaries. A setting change preserves the
active assignment. The next assignment may use the new zone only if its window
does not overlap an earlier assignment of that key. This can intentionally leave
a short gap after a zone change; it prevents overlapping period rewards.
Only current assignments can complete. Expired rows are retained but never awarded
retroactively. There is no client clock, owner, reward, or requirement argument.

Progress is derived, not stored as an editable counter. Evidence must join an
owner's immutable Focus/Task reward event to its still-valid canonical source.
Both the accepted reward timestamp and canonical completion timestamp must be
inside the assignment and not in the future. Focus must be completed, at least
one minute long, and in completed timer state; accepted whole-minute XP determines
its minute contribution. Tasks must still be completed. Subject attribution uses
the reward snapshot and checks that the subject still belongs to the owner.
Reopening/recompleting an already-rewarded task in another period cannot earn
challenge credit again. Delayed claims for expired activity do not count.

## Atomic event flow

1. The existing public Focus/Task claim locks the owner's progression row.
2. The original private reward core validates and awards the source once.
3. Existing automatic City construction processes that new reward.
4. For newly awarded claims only, evaluate_progression_challenges derives progress.
5. Newly completed assignments insert one challenge_completed event, update balances,
   and invoke the same private City orchestrator with that event.
6. The claim returns challenge receipts and final post-spending balances.

Standalone authenticated evaluation is also available. Repeated evaluations skip
completed assignments; the unique reward source is the assignment UUID. City
records processed challenge reward IDs just as it does Focus/Task IDs. The owner
lock serializes these paths. Any unexpected failure rolls back the entire claim,
including base rewards, challenge completion, spending and City state.

Existing reward and City implementations remain authoritative. The new migration
replaces the City orchestration definition only to allow challenge_completed as
another trusted source; it does not change costs, priorities or construction logic.
There is no backfill during migration application, and independent achievement
evaluations are not challenge triggers.

## Security and validation

Both new public tables have RLS. Authenticated users can read the catalog and their
own assignments only; direct writes and anonymous access are revoked. The evaluator
checks auth.uid(), explicitly scopes every source to that owner, uses an empty
search_path and has no anonymous/PUBLIC execution grant. The period helper lives
in a private schema with no client usage or execute privileges.

Database tests first run the 609 prior assertions on the preceding schema, then
apply this additive migration over populated data and verify preservation. The
final-schema suite covers grants/RLS, source eligibility, exact reward accounting,
replays, City effects, rollback, daily/weekly boundaries, Cairo and DST behavior.
Pure tests cover catalog uniqueness, reward parity and invalid progress/targets.

Remaining rollout gates: real multi-connection PostgreSQL concurrency tests and
query plans at realistic activity volumes. PGlite serializes requests and cannot
prove those properties. Actual study trust remains bounded by the existing
Focus/Task completion and reward model. Active production flows must remain
disconnected until separately authorized migration rollout and integration.
