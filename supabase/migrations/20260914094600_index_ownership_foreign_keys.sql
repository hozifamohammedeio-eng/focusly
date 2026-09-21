-- Cover both columns of each ownership-enforcing foreign key.
-- Original Phase 1 and Phase 2 migrations remain unchanged.
create index tasks_subject_owner_idx on public.tasks (subject_id, user_id);
create index study_blocks_subject_owner_idx on public.study_blocks (subject_id, user_id);
create index focus_sessions_subject_owner_idx on public.focus_sessions (subject_id, user_id);
create index focus_sessions_task_owner_idx on public.focus_sessions (task_id, user_id);
