-- Focusly 2.0 achievements foundation.
-- Local additive migration only; do not apply remotely in this phase.

create table public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_key text not null,
  unlocked_at timestamptz not null default now(),
  constraint user_achievements_key_check check (
    achievement_key in (
      'first_focus',
      'focus_5',
      'focus_60_minutes',
      'focus_300_minutes',
      'first_task',
      'tasks_10',
      'level_2',
      'level_5',
      'first_subject_level_2'
    )
  ),
  constraint user_achievements_unique_key unique (user_id, achievement_key)
);

create index user_achievements_user_unlocked_idx
  on public.user_achievements(user_id, unlocked_at desc);

alter table public.user_achievements enable row level security;

revoke all on table public.user_achievements from anon, authenticated;
grant select on table public.user_achievements to authenticated;

create policy user_achievements_select_own
  on public.user_achievements
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.evaluate_progression_achievements()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  focus_count bigint;
  focus_minutes bigint;
  task_count bigint;
  total_xp bigint;
  subject_level_two boolean;
  candidate record;
  achievement_row public.user_achievements;
  reward_event_row public.progression_reward_events;
  progression_row public.progression_profiles;
  unlocked jsonb := '[]'::jsonb;
begin
  if owner_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select count(*)::bigint, coalesce(sum(floor(duration_seconds / 60.0)), 0)::bigint
  into focus_count, focus_minutes
  from public.focus_sessions
  where user_id = owner_id
    and completed = true
    and ended_at is not null
    and duration_seconds >= 60;

  select count(*)::bigint
  into task_count
  from public.tasks
  where user_id = owner_id
    and status = 'completed'
    and completed_at is not null;

  select coalesce(sum(e.xp), 0)::bigint
  into total_xp
  from public.progression_reward_events e
  where e.user_id = owner_id;

  total_xp := coalesce(total_xp, 0);

  select exists(
    select 1
    from public.subjects s
    where s.user_id = owner_id
      and (
        select coalesce(sum(e.xp), 0)
        from public.progression_reward_events e
        where e.user_id = owner_id
          and e.subject_id = s.id
      ) >= 100
  )
  into subject_level_two;

  insert into public.progression_profiles(user_id)
  values (owner_id)
  on conflict (user_id) do nothing;

  for candidate in
    select *
    from (values
      ('first_focus', 5, 5, 0, focus_count >= 1),
      ('focus_5', 50, 10, 0, focus_count >= 5),
      ('focus_60_minutes', 60, 12, 0, focus_minutes >= 60),
      ('focus_300_minutes', 150, 30, 0, focus_minutes >= 300),
      ('first_task', 5, 5, 0, task_count >= 1),
      ('tasks_10', 100, 20, 0, task_count >= 10),
      -- Existing level curve: level 2 starts at 100 XP; level 5 at 550 XP.
      ('level_2', 100, 20, 0, total_xp >= 100),
      ('level_5', 250, 50, 0, total_xp >= 550),
      ('first_subject_level_2', 100, 20, 0, subject_level_two)
    ) as definitions(achievement_key, reward_xp, reward_coins, reward_construction_points, eligible)
    where eligible
    order by achievement_key
  loop
    achievement_row := null;
    insert into public.user_achievements(user_id, achievement_key)
    values (owner_id, candidate.achievement_key)
    on conflict (user_id, achievement_key) do nothing
    returning * into achievement_row;

    if achievement_row.id is null then
      continue;
    end if;

    reward_event_row := null;
    insert into public.progression_reward_events(
      user_id,
      subject_id,
      event_type,
      source_id,
      xp,
      coins,
      construction_points
    ) values (
      owner_id,
      null,
      'achievement_unlocked',
      candidate.achievement_key,
      candidate.reward_xp,
      candidate.reward_coins,
      candidate.reward_construction_points
    )
    on conflict (user_id, event_type, source_id) do nothing
    returning * into reward_event_row;

    if reward_event_row.id is not null then
      update public.progression_profiles pp
      set total_xp = pp.total_xp + candidate.reward_xp,
          coins = pp.coins + candidate.reward_coins,
          construction_points = pp.construction_points + candidate.reward_construction_points,
          updated_at = clock_timestamp()
      where pp.user_id = owner_id
      returning pp.* into progression_row;

      unlocked := unlocked || jsonb_build_array(jsonb_build_object(
        'achievementKey', candidate.achievement_key,
        'unlockedAt', achievement_row.unlocked_at,
        'reward', jsonb_build_object(
          'xp', candidate.reward_xp,
          'coins', candidate.reward_coins,
          'constructionPoints', candidate.reward_construction_points
        ),
        'balances', jsonb_build_object(
          'totalXp', progression_row.total_xp,
          'coins', progression_row.coins,
          'constructionPoints', progression_row.construction_points
        )
      ));
    end if;
  end loop;

  return unlocked;
end;
$$;

revoke all on function public.evaluate_progression_achievements() from public, anon;
grant execute on function public.evaluate_progression_achievements() to authenticated;
