# Local City domain and database foundation

The City foundation is now active: persisted building levels and trusted reward
receipts drive automatic progression. `/app/city` reads that state and includes a
Papercut Focus Tower scene; neither City view awards progress itself.

## Model and balancing

`src/features/city/catalog.json` contains six stable keys and presentation defaults.
`public.city_building_catalog` is the authoritative database catalog. The embedded
database suite asserts exact parity. Future balancing changes require a new
additive migration plus a catalog update; do not edit deployed migrations.

Each building starts at level 1 and is capped at level 3. Build cost is its base
Coins/Construction Points; an upgrade costs base amounts times the next level.
Requirements also scale by target level. These are initial balancing choices,
not a production economy commitment.

| Building | Base Coins / Points | Base requirement |
| --- | --- | --- |
| knowledge_center | 10 / 5 | 100 earned global XP |
| focus_tower | 5 / 5 | 25 completed focus minutes |
| library_district | 10 / 5 | 100 XP on one owned subject |
| science_lab | 15 / 10 | 225 XP on one owned subject |
| language_academy | 15 / 10 | 225 XP on one owned subject |
| planner_hall | 5 / 2 | 5 completed tasks |

Science and language use generic subject mastery. Subject names are not trusted
classification data. A later authoritative subject taxonomy can add requirement
metrics without guessing categories from names.

Only owned buildings have rows. Level 0 in domain helpers means absent/unbuilt:
`locked` or `available` depends on requirements. Owned buildings are `built` or
`upgradeable`; affordability is a separate check. Losing qualifying evidence does
not revoke ownership. Max-level buildings remain `built`.

## Transactions and security

`city_transaction(action, building_key, request_id, building_id?, expected_level?)`
supports build and upgrade. `user_id` always comes from `auth.uid()`.
Costs, requirements, balance mutations and next level are computed inside SQL.
An upgrade's expected level is an optimistic concurrency check, not a desired
result. Its ID must belong to the caller and match the requested key.

The existing progression balance row is locked before checking a receipt, reading
ownership, or spending. All City purchases for one user share this lock. Existing
reward balance UPDATEs acquire the same row lock, so increments are not lost.
At stricter isolation levels PostgreSQL may return a serialization failure;
retry the same logical request with the same request ID.

`city_transactions` stores the request fingerprint, exact costs, resulting level
and original JSON receipt. Matching retries return that receipt, even after later
upgrades. Reusing the ID with a changed payload fails. A unique owner/building/level
constraint and unique building ownership add protection against duplicate work.
All debits, building mutations and receipts share the caller's database transaction.
Failure rolls everything back. Existing nonnegative balance constraints remain.

Receipt balances are historical snapshots, not fresh balances. Earned XP and the
reward ledger remain unchanged by spending. Reconciliation must subtract the City
spend ledger from earned currencies; `calculateBalancesFromEvents` represents
earnings, not spend-adjusted balances. The normal progression reader already uses
the persisted profile when it exists. Building/receipt foreign keys prevent those
records from outliving their progression profile.

All three tables have RLS. Authenticated users may read the public catalog and only
their own buildings/receipts. They cannot insert, update, delete or truncate these
tables directly. Anonymous access is revoked. The RPC requires authentication,
uses an empty search path and fully qualified application objects, and explicitly
revokes public/anonymous execution. This follows the project's existing secure RPC
pattern and [Supabase function guidance](https://supabase.com/docs/guides/database/functions).

## Automatic construction (local migration only)

New successful `claim_focus_progression_reward` and `claim_task_progression_reward`
calls now run automatic construction inside the reward transaction. Their tested
reward implementations are moved into the inaccessible `focusly_city_internal`
schema and invoked by public wrappers. Invalid sources fail before construction;
starting or discarding Focus never calls this orchestrator. No City visit or
additional browser City request is needed.

The wrappers lock the owner's progression row before reward creation, then pass
the new owner-scoped reward event to the private orchestrator. The orchestrator
calls the existing `city_transaction` authority for every proposed change. It
skips only unmet requirements and insufficient balances. All other errors abort
the complete claim, including its reward, spending, buildings and processing log.
The existing costs, requirements and maximum level remain unchanged.

The single policy is **level first, then catalog priority**: try level 1 for
Knowledge Center, Focus Tower, Library District, Science Lab, Language Academy,
Planner Hall; then try levels 2 and 3 in that order. `auto_priority` in the SQL
catalog is authoritative. Each step is attempted once per new event, for at most
18 successful operations with the current catalog. Skipped steps are reconsidered
only on a later new study reward. This gives foundations priority over upgrades;
it does not reserve funds for an unaffordable higher-priority building.

`city_auto_events` records each processed reward once, including empty passes.
It has owner-only reads, RLS and no direct API writes. Automatic spending receipts
carry `source_reward_event_id`. A repeated claim returns `awarded: false` and an
empty `cityConstruction` array; it never runs another construction pass, even if
balances or eligibility have since changed. Successful responses contain the
construction receipts and **post-spending** balances. There is no backfill of old
reward events. Independently evaluated achievement rewards are not a new auto
trigger in this phase; their balances/XP can help on the next new Focus/Task claim.

This remains local infrastructure. Active production completion routes do not yet
call these local-only reward RPCs, and the City page still has no new dependency.
Connecting live completion flows and City reads requires a later migration rollout
and explicitly authorized application integration. No live automatic growth is
claimed by this foundation.

## Validation and remaining rollout gates

- Existing `test:progression` now also runs pure City domain tests.
- Existing `test:db` runs real migrations in ephemeral PGlite and extends the suite
  with permissions, isolation, canonical eligibility, retry and rollback checks.
- Catalog parity is checked against SQL rather than maintaining unchecked copies.
- Promise-based repeated requests in PGlite are queued, not true multi-connection
  concurrency tests. Validate competing builds/upgrades/rewards with separate
  PostgreSQL connections before any production rollout.
- No production UI is connected. Review balancing, real concurrency, hosted migration
  history and deployment order in separately authorized phases.
