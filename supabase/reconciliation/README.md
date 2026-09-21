# Existing remote project reconciliation

Completed against lxlpnynpatnsfvvvxwwx on 14 September 2026. See the workspace outputs/Focusly-Reconciliation-Report.md and verification artifacts for the audit and results.

The one-time preserve_legacy_schema script in this directory runs BEFORE the original Phase 1 migration, on the audited legacy schema only. It is deliberately outside migrations/: do not run it on a fresh database. The normal migrations/ directory supports fresh installations, including an import that safely skips when no archive exists.

Remote migrations were applied by Supabase MCP, which assigned deployment timestamps. remote-history.json records the true remote versions and source mapping. All recorded SQL was checked against the source. No history was repaired, rewritten, or marked successful without executing it. Original Phase 1/2 files are unchanged.

Do not run db push blindly from the original migrations directory against this reconciled project: CLI matches version filenames, while MCP assigned different versions. Continue deploying new migrations through the authenticated Supabase migration tool, or prepare a separate deployment-only migration directory using the exact remote versions from this manifest before switching to CLI. Do not rename the original files or rewrite remote history to hide the difference.

Archived tables are focusly_legacy.profiles, subjects and tasks. Eight other legacy tables retain public names but have no anon/authenticated/PUBLIC table grants. RLS remains enabled on all eleven. Neither the archive nor public legacy tables are used by the new application. Never remove them without explicit cleanup authorization.

The archived provisioning function has no trigger. Exactly one new Auth provisioning trigger is active. Original function/trigger definitions are backed up. Restoring legacy service requires planning around any new user data; the preparation is not an automatic rollback script.

Reconciliation test: node tests/reconciliation.mjs <path-to-pglite/dist/index.js> 20260914094033_import_legacy_user_data.sql

Live test (creates real temporary accounts, opt-in only): node --env-file=.env.local tests/live-reconciliation.mjs --run-live

Existing live-test accounts are signed out and retained for audit. No passwords/tokens were written to artifacts. User UUIDs are in the live result artifact for later authorized cleanup.
