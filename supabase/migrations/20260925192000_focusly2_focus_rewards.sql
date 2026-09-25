-- ============================================================
-- Focusly 2.0
-- Focus Session Progression Rewards
--
-- LOCAL MIGRATION ONLY FOR NOW.
-- Do not push/apply until reviewed and tested.
-- ============================================================


-- ============================================================
-- claim_focus_progression_reward
--
-- Purpose:
--
-- Turn one REAL completed focus session into one progression
-- reward event.
--
-- Security:
--
-- - The caller must be authenticated.
-- - The focus session must belong to auth.uid().
-- - The session must be completed.
-- - The session must contain at least 60 seconds of study.
-- - Reward amounts are calculated inside PostgreSQL.
-- - The client never supplies XP / Coins / Construction Points.
-- - The reward ledger unique constraint prevents duplicates.
--
-- Persisted reward rules:
--
-- 1 full study minute = 1 XP
-- Every 5 full minutes = 1 Coin
-- Every 5 full minutes = 1 Construction Point
--
-- Example:
--
-- 25 minutes
-- = 25 XP
-- = 5 Coins
-- = 5 Construction Points
--
-- ============================================================

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
    event_type,
    source_id,
    xp,
    coins,
    construction_points
  )
  values (
    owner_id,
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


-- ============================================================
-- Function permissions
--
-- The function is the ONLY path authenticated users need for
-- awarding Focus progression.
-- ============================================================

revoke all
  on function public.claim_focus_progression_reward(uuid)
  from public;

revoke all
  on function public.claim_focus_progression_reward(uuid)
  from anon;

grant execute
  on function public.claim_focus_progression_reward(uuid)
  to authenticated;