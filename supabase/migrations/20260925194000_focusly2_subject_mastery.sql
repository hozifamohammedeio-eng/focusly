-- Focusly 2.0 Subject Mastery foundation.
-- Local additive migration only; do not apply remotely in this phase.

alter table public.progression_reward_events
  add column subject_id uuid;

alter table public.progression_reward_events
  add constraint progression_reward_events_subject_owner_fk
  foreign key (subject_id, user_id)
  references public.subjects (id, user_id)
  on delete set null (subject_id);

create index progression_reward_events_user_subject_created_idx
  on public.progression_reward_events(user_id, subject_id, created_at desc);
create or replace function public.claim_focus_progression_reward(
  p_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();

  session_row public.focus_sessions;

  reward_event_row
    public.progression_reward_events;

  progression_row
    public.progression_profiles;

  whole_minutes integer;

  reward_xp integer;

  reward_coins integer;

  reward_construction_points integer;
begin

  -- ==========================================================
  -- Authentication
  -- ==========================================================

  if owner_id is null then
    raise exception
      'Authentication required'
      using errcode = '42501';
  end if;


  -- ==========================================================
  -- Validate the source study session
  -- ==========================================================

  select *
  into session_row
  from public.focus_sessions
  where id = p_session_id
    and user_id = owner_id
    and completed = true
    and duration_seconds >= 60
    and ended_at is not null;

  if not found then
    raise exception
      'Completed focus session unavailable'
      using errcode = 'P0002';
  end if;


  -- ==========================================================
  -- Calculate trusted study duration
  --
  -- Only full study minutes count toward progression.
  -- ==========================================================

  whole_minutes :=
    floor(
      session_row.duration_seconds
      / 60.0
    )::integer;


  if whole_minutes < 1 then
    raise exception
      'Focus session is too short for progression'
      using errcode = '22023';
  end if;


  -- ==========================================================
  -- Reward balancing
  --
  -- Keep synchronized with:
  --
  -- src/features/progression/rewards.ts
  --
  -- PostgreSQL is authoritative for persisted rewards.
  -- ==========================================================

  reward_xp :=
    whole_minutes;

  reward_coins :=
    floor(
      whole_minutes / 5.0
    )::integer;

  reward_construction_points :=
    floor(
      whole_minutes / 5.0
    )::integer;


  -- ==========================================================
  -- Ensure the user has a progression profile
  -- ==========================================================

  insert into public.progression_profiles (
    user_id
  )
  values (
    owner_id
  )
  on conflict (
    user_id
  )
  do nothing;


  -- ==========================================================
  -- Attempt to create the immutable reward event
  --
  -- The UNIQUE constraint:
  --
  -- user_id + event_type + source_id
  --
  -- makes this operation idempotent.
  -- ==========================================================

  insert into public.progression_reward_events (
    user_id,
    subject_id,
    event_type,
    source_id,
    xp,
    coins,
    construction_points
  )
  values (
    owner_id,
    session_row.subject_id,
    'focus_completed',
    p_session_id::text,
    reward_xp,
    reward_coins,
    reward_construction_points
  )
  on conflict (
    user_id,
    event_type,
    source_id
  )
  do nothing
  returning *
  into reward_event_row;


  -- ==========================================================
  -- Duplicate reward
  --
  -- Nothing is added to balances.
  -- Return the current progression state.
  -- ==========================================================

  if reward_event_row.id is null then

    select *
    into progression_row
    from public.progression_profiles
    where user_id = owner_id;

    return jsonb_build_object(
      'awarded',
      false,

      'reason',
      'already_awarded',

      'sessionId',
      p_session_id,

      'reward',
      jsonb_build_object(
        'xp',
        0,

        'coins',
        0,

        'constructionPoints',
        0
      ),

      'balances',
      jsonb_build_object(
        'totalXp',
        progression_row.total_xp,

        'coins',
        progression_row.coins,

        'constructionPoints',
        progression_row.construction_points
      ),

      'serverNow',
      clock_timestamp()
    );

  end if;


  -- ==========================================================
  -- Apply reward atomically to the cached balances
  --
  -- UPDATE increments are safe if multiple different rewards
  -- are claimed concurrently.
  -- ==========================================================

  update public.progression_profiles
  set
    total_xp =
      total_xp
      + reward_xp,

    coins =
      coins
      + reward_coins,

    construction_points =
      construction_points
      + reward_construction_points,

    updated_at =
      clock_timestamp()

  where user_id = owner_id

  returning *
  into progression_row;


  -- ==========================================================
  -- Return awarded reward + latest balances
  -- ==========================================================

  return jsonb_build_object(
    'awarded',
    true,

    'reason',
    'focus_completed',

    'sessionId',
    p_session_id,

    'eventId',
    reward_event_row.id,

    'durationMinutes',
    whole_minutes,

    'reward',
    jsonb_build_object(
      'xp',
      reward_xp,

      'coins',
      reward_coins,

      'constructionPoints',
      reward_construction_points
    ),

    'balances',
    jsonb_build_object(
      'totalXp',
      progression_row.total_xp,

      'coins',
      progression_row.coins,

      'constructionPoints',
      progression_row.construction_points
    ),

    'serverNow',
    clock_timestamp()
  );

end;
$$;

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
    user_id, subject_id, event_type, source_id, xp, coins, construction_points
  ) values (
    owner_id, task_row.subject_id, 'task_completed', p_task_id::text, 15, 2, 1
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

create or replace function public.get_subject_mastery()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'subjectId', s.id,
        'subjectName', s.name,
        'archivedAt', s.archived_at,
        'totalXp', coalesce((
          select sum(e.xp)::bigint
          from public.progression_reward_events e
          where e.user_id = s.user_id
            and e.subject_id = s.id
        ), 0),
        'totalStudyMinutes', coalesce((
          select sum(floor(f.duration_seconds / 60.0))::bigint
          from public.focus_sessions f
          where f.user_id = s.user_id
            and f.subject_id = s.id
            and f.completed = true
            and f.ended_at is not null
            and f.duration_seconds >= 60
        ), 0),
        'completedFocusSessions', (
          select count(*)::bigint
          from public.focus_sessions f
          where f.user_id = s.user_id
            and f.subject_id = s.id
            and f.completed = true
            and f.ended_at is not null
            and f.duration_seconds >= 60
        ),
        'completedTasks', (
          select count(*)::bigint
          from public.tasks t
          where t.user_id = s.user_id
            and t.subject_id = s.id
            and t.status = 'completed'
            and t.completed_at is not null
        )
      )
      order by s.sort_order, s.id
    ),
    '[]'::jsonb
  )
  from public.subjects s
  where s.user_id = (select auth.uid());
$$;

revoke all on function public.get_subject_mastery() from public, anon;
grant execute on function public.get_subject_mastery() to authenticated;
revoke all on function public.claim_focus_progression_reward(uuid) from public, anon;
grant execute on function public.claim_focus_progression_reward(uuid) to authenticated;

revoke all on function public.claim_task_progression_reward(uuid) from public, anon;
grant execute on function public.claim_task_progression_reward(uuid) to authenticated;
