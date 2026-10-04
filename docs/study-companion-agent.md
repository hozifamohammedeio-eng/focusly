# Focusly Agent local implementation

The V1 floating companion remains the entry point. A bounded server action loads
only owner-scoped Focusly context when the student sends a message. Gemini uses
the existing server-only `GEMINI_API_KEY` and `FOCUSLY_AI_PLANNER_MODEL` to
propose at most two structured calls. The server rejects unknown tools and
arguments, resolves dates in the student's saved timezone, rechecks ownership,
and executes only registered application operations. No SQL, RPC name, URL,
user ID, or reward amount comes from the model.

Available read tools: `read_day`, `read_week`, `list_tasks`, `list_subjects`,
`list_schedule`, `list_reminders`, `read_settings`, `read_focus`,
`read_progress`, `read_achievements`, `read_challenges`, `read_city`.

Available write tools: `create_task`, `update_task`, `complete_task`,
`delete_task`, `create_subject`, `update_subject`, `delete_subject`,
`create_block`, `move_block`, `delete_block`, `create_reminder`,
`edit_reminder`, `cancel_reminder`, `set_goal`, `set_locale`, `set_theme`,
`set_accent`, `set_display_name`, `set_companion_name`,
`set_companion_enabled`, `set_auto_greeting`.

`plan_day` proposes one open study slot around existing blocks and lessons; it
does not silently apply a schedule. The student confirms the proposed block.
Destructive calls, two-call requests, and unclear instructions also require
confirmation. Ambiguous owned records trigger a clarification instead of an
arbitrary first match. Server actions re-authenticate and re-resolve on both
initial execution and confirmation.

Task completion delegates to the existing trusted mutation path, preserving
the current reward and achievement rules. The agent cannot award XP, Coins,
Challenges, Achievements, or City progression. Planner moves delegate to the
existing overlap-aware mutation. Task and block creation use a stable
request-scoped ID; reminder creation reuses V1's idempotent saver. The client
also blocks duplicate submits. A multi-step command executes sequentially;
if a later step fails, the reply reports the completed earlier step and the
failure. It does not claim all-or-nothing transactionality.

Deliberately unsupported in V2: automatic bulk edits/clears, direct Focus
timer control (the timer's client recovery state should not be bypassed),
education-system changes, recurring-lesson edits, and agent-triggered reward
or AI Weekly Planner generation. Those need dedicated product workflows or
transactional design before enabling.

No new database migration is required. The already-existing V1 companion
migration remains a prerequisite and must be reviewed and applied separately
before any V2 deployment. This local task does not apply hosted migrations,
push Git, or deploy.
