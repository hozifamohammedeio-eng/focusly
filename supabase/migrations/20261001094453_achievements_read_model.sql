-- Owner-scoped evidence for the nine existing achievement rules.
-- Read-only: this function does not call the evaluator or write reward state.
create function public.get_achievement_progress()
returns table(achievement_key text, progress bigint, target bigint)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  focus_count bigint;
  focus_minutes bigint;
  task_count bigint;
  total_xp bigint;
  max_subject_xp bigint;
begin
  if owner_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- Match evaluate_progression_achievements exactly: only completed sessions
  -- of at least one whole minute, and tasks with a completion timestamp.
  select count(*)::bigint, coalesce(sum(floor(duration_seconds / 60.0)), 0)::bigint
  into focus_count, focus_minutes
  from public.focus_sessions
  where user_id = owner_id
    and completed = true
    and ended_at is not null
    and duration_seconds >= 60;

  select count(*)::bigint into task_count
  from public.tasks
  where user_id = owner_id
    and status = 'completed'
    and completed_at is not null;

  select coalesce(sum(e.xp), 0)::bigint into total_xp
  from public.progression_reward_events e
  where e.user_id = owner_id;

  select coalesce(max(subject_xp), 0)::bigint into max_subject_xp
  from (
    select coalesce(sum(e.xp), 0)::bigint as subject_xp
    from public.subjects s
    left join public.progression_reward_events e
      on e.user_id = owner_id and e.subject_id = s.id
    where s.user_id = owner_id
    group by s.id
  ) totals;

  return query
  select definitions.key, definitions.current_value, definitions.goal
  from (values
    ('first_focus'::text, focus_count, 1::bigint),
    ('focus_5', focus_count, 5::bigint),
    ('focus_60_minutes', focus_minutes, 60::bigint),
    ('focus_300_minutes', focus_minutes, 300::bigint),
    ('first_task', task_count, 1::bigint),
    ('tasks_10', task_count, 10::bigint),
    ('level_2', total_xp, 100::bigint),
    ('level_5', total_xp, 550::bigint),
    ('first_subject_level_2', max_subject_xp, 100::bigint)
  ) as definitions(key, current_value, goal);
end;
$$;

revoke all on function public.get_achievement_progress() from public, anon;
grant execute on function public.get_achievement_progress() to authenticated;
