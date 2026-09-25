-- ============================================================
-- Focusly 2.0
-- Progression Foundation
--
-- LOCAL MIGRATION ONLY FOR NOW.
-- Do not push/apply until reviewed and tested.
-- ============================================================


-- ============================================================
-- 1. Progression balances
-- ============================================================

create table if not exists public.progression_profiles (
  user_id uuid primary key
    references auth.users(id)
    on delete cascade,

  total_xp bigint not null default 0,

  coins bigint not null default 0,

  construction_points bigint not null default 0,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),

  constraint progression_profiles_total_xp_check
    check (total_xp >= 0),

  constraint progression_profiles_coins_check
    check (coins >= 0),

  constraint progression_profiles_construction_points_check
    check (construction_points >= 0)
);


-- ============================================================
-- 2. Reward event ledger
-- ============================================================

create table if not exists public.progression_reward_events (
  id uuid primary key
    default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  event_type text not null,

  source_id text not null,

  xp integer not null default 0,

  coins integer not null default 0,

  construction_points integer not null default 0,

  created_at timestamptz not null default now(),

  constraint progression_reward_events_type_check
    check (
      event_type in (
        'focus_completed',
        'task_completed',
        'achievement_unlocked',
        'challenge_completed',
        'subject_milestone'
      )
    ),

  constraint progression_reward_events_source_check
    check (
      char_length(btrim(source_id))
      between 1 and 200
    ),

  constraint progression_reward_events_xp_check
    check (xp >= 0),

  constraint progression_reward_events_coins_check
    check (coins >= 0),

  constraint progression_reward_events_construction_check
    check (construction_points >= 0),

  constraint progression_reward_events_non_empty_check
    check (
      xp > 0
      or coins > 0
      or construction_points > 0
    ),

  constraint progression_reward_events_unique_source
    unique (
      user_id,
      event_type,
      source_id
    )
);


-- ============================================================
-- 3. Query indexes
-- ============================================================

create index if not exists progression_reward_events_user_created_idx
  on public.progression_reward_events(
    user_id,
    created_at desc
  );

create index if not exists progression_reward_events_user_type_idx
  on public.progression_reward_events(
    user_id,
    event_type,
    created_at desc
  );


-- ============================================================
-- 4. Row Level Security
-- ============================================================

alter table public.progression_profiles
  enable row level security;

alter table public.progression_reward_events
  enable row level security;


-- ============================================================
-- 5. Privileges
-- ============================================================

revoke all
  on table public.progression_profiles
  from anon;

revoke all
  on table public.progression_reward_events
  from anon;

revoke all
  on table public.progression_profiles
  from authenticated;

revoke all
  on table public.progression_reward_events
  from authenticated;

grant select
  on table public.progression_profiles
  to authenticated;

grant select
  on table public.progression_reward_events
  to authenticated;


-- ============================================================
-- 6. Progression profile ownership
-- ============================================================

drop policy if exists
  "progression_profiles_select_own"
  on public.progression_profiles;

create policy
  "progression_profiles_select_own"
  on public.progression_profiles
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
  );


-- ============================================================
-- 7. Reward event ownership
-- ============================================================

drop policy if exists
  "progression_reward_events_select_own"
  on public.progression_reward_events;

create policy
  "progression_reward_events_select_own"
  on public.progression_reward_events
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
  );


-- ============================================================
-- No INSERT / UPDATE / DELETE policies are intentionally
-- created for authenticated users.
--
-- Progression currency must never be client-controlled.
-- ============================================================