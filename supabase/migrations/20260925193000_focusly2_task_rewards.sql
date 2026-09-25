-- Focusly 2.0: trusted task completion rewards.
-- Local migration only; do not apply remotely in this phase.

create or replace function public.claim_task_progression_reward(
  p_task_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  task_row public.tasks;
  reward_event_row public.progression_reward_events;
  progression_row public.progression_profiles;
begin
  if owner_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into task_row
  from public.tasks
  where id = p_task_id
    and user_id = owner_id
    and status = 'completed'
    and completed_at is not null;

  if not found then
    raise exception 'Completed task unavailable' using errcode = 'P0002';
  end if;

  insert into public.progression_profiles(user_id)
  values (owner_id)
  on conflict (user_id) do nothing;

  insert into public.progression_reward_events(
    user_id, event_type, source_id, xp, coins, construction_points
  ) values (
    owner_id, 'task_completed', p_task_id::text, 15, 2, 1
  )
  on conflict (user_id, event_type, source_id)
  do nothing
  returning * into reward_event_row;

  if reward_event_row.id is null then
    select * into progression_row
    from public.progression_profiles
    where user_id = owner_id;

    return jsonb_build_object(
      'awarded', false,
      'reason', 'already_awarded',
      'taskId', p_task_id,
      'reward', jsonb_build_object('xp', 0, 'coins', 0, 'constructionPoints', 0),
      'balances', jsonb_build_object(
        'totalXp', progression_row.total_xp,
        'coins', progression_row.coins,
        'constructionPoints', progression_row.construction_points
      ),
      'serverNow', clock_timestamp()
    );
  end if;

  update public.progression_profiles
  set total_xp = total_xp + 15,
      coins = coins + 2,
      construction_points = construction_points + 1,
      updated_at = clock_timestamp()
  where user_id = owner_id
  returning * into progression_row;

  return jsonb_build_object(
    'awarded', true,
    'reason', 'task_completed',
    'taskId', p_task_id,
    'eventId', reward_event_row.id,
    'reward', jsonb_build_object('xp', 15, 'coins', 2, 'constructionPoints', 1),
    'balances', jsonb_build_object(
      'totalXp', progression_row.total_xp,
      'coins', progression_row.coins,
      'constructionPoints', progression_row.construction_points
    ),
    'serverNow', clock_timestamp()
  );
end;
$$;

revoke all on function public.claim_task_progression_reward(uuid) from public, anon;
grant execute on function public.claim_task_progression_reward(uuid) to authenticated;
