-- LOCAL ONLY. No live route depends on this challenge engine.
create table public.challenge_catalog (
  key text primary key check (char_length(key) between 1 and 80),
  kind text not null check (kind in ('daily','weekly')),
  metric text not null check (metric in ('focus_minutes','completed_tasks','studied_subjects')),
  target integer not null check (target > 0),
  xp integer not null,
  coins integer not null,
  -- Mirrors the existing central progression reward rules, not a new economy.
  constraint challenge_rewards_valid check (
    (kind='daily' and xp=50 and coins=10) or
    (kind='weekly' and xp=150 and coins=30)
  )
);
insert into public.challenge_catalog(key,kind,metric,target,xp,coins) values
  ('daily_focus_25','daily','focus_minutes',25,50,10),
  ('daily_tasks_2','daily','completed_tasks',2,50,10),
  ('weekly_focus_180','weekly','focus_minutes',180,150,30),
  ('weekly_subjects_2','weekly','studied_subjects',2,150,30);
alter table public.challenge_catalog enable row level security;
revoke all on public.challenge_catalog from public, anon, authenticated;
grant select on public.challenge_catalog to authenticated;
create policy challenge_catalog_read on public.challenge_catalog for select to authenticated using (true);

create table public.user_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.progression_profiles(user_id) on delete cascade,
  challenge_key text not null references public.challenge_catalog(key),
  time_zone text not null check (private.valid_time_zone(time_zone)),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  completed_at timestamptz,
  reward_event_id uuid unique references public.progression_reward_events(id),
  unique(user_id,challenge_key,starts_at),
  check (ends_at > starts_at),
  check ((completed_at is null and reward_event_id is null) or
    (completed_at is not null and completed_at >= starts_at and completed_at < ends_at and reward_event_id is not null))
);
create index user_challenges_owner_window_idx on public.user_challenges(user_id,ends_at);
alter table public.user_challenges enable row level security;
revoke all on public.user_challenges from public, anon, authenticated;
grant select on public.user_challenges to authenticated;
create policy user_challenges_read_own on public.user_challenges for select to authenticated
  using ((select auth.uid())=user_id);

create schema focusly_challenge_internal;
revoke all on schema focusly_challenge_internal from public, anon, authenticated;

-- Private clock helper: callers cannot choose an evaluation time or timezone.
-- Convert each local midnight separately so DST days are 23/24/25 hours.
create function focusly_challenge_internal.period(p_kind text,p_zone text,p_now timestamptz)
returns table(starts_at timestamptz,ends_at timestamptz)
language plpgsql stable set search_path='' as $$
declare d date := (p_now at time zone p_zone)::date;
begin
  if p_kind not in ('daily','weekly') then raise exception 'Invalid challenge kind' using errcode='22023'; end if;
  if p_kind='weekly' then d := d-((extract(dow from d)::integer+1)%7); end if;
  return query select d::timestamp at time zone p_zone,
    (d+case when p_kind='daily' then 1 else 7 end)::timestamp at time zone p_zone;
end;
$$;
revoke all on function focusly_challenge_internal.period(text,text,timestamptz) from public,anon,authenticated;

create function public.evaluate_progression_challenges()
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  owner_id uuid := auth.uid();
  server_now timestamptz;
  zone text;
  definition public.challenge_catalog;
  assignment public.user_challenges;
  window_start timestamptz;
  window_end timestamptz;
  progress bigint;
  event_id uuid;
  construction jsonb;
  result jsonb := '[]'::jsonb;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  insert into public.progression_profiles(user_id) values(owner_id) on conflict(user_id) do nothing;
  perform 1 from public.progression_profiles where user_id=owner_id for update;
  -- Read the clock after waiting for the owner lock, never from the caller.
  server_now := clock_timestamp();
  select coalesce(time_zone,'UTC') into zone from public.user_settings where user_id=owner_id;
  zone := coalesce(zone,'UTC');
  for definition in select * from public.challenge_catalog order by key loop
    select * into assignment from public.user_challenges
      where user_id=owner_id and challenge_key=definition.key
        and starts_at<=server_now and ends_at>server_now order by starts_at desc limit 1;
    if not found then
      select p.starts_at,p.ends_at into window_start,window_end
        from focusly_challenge_internal.period(definition.kind,zone,server_now) p;
      -- Freeze active windows. After a zone change, skip an overlapping window
      -- rather than granting the same study time a second daily/weekly award.
      if exists(select 1 from public.user_challenges where user_id=owner_id
        and challenge_key=definition.key and starts_at<window_end and ends_at>window_start) then continue; end if;
      insert into public.user_challenges(user_id,challenge_key,time_zone,starts_at,ends_at)
        values(owner_id,definition.key,zone,window_start,window_end) returning * into assignment;
    end if;
    if assignment.completed_at is not null then continue; end if;

    -- Count only accepted, owner-scoped canonical study sources. The immutable
    -- reward timestamp also gates the window, so reopening an old task cannot
    -- move its one accepted reward into another period. Subject credit comes
    -- from the reward snapshot, not a later edited association.
    with activity as (
      select e.id,e.subject_id,e.event_type,e.xp
      from public.progression_reward_events e
      join public.focus_sessions f on e.source_id=f.id::text and f.user_id=e.user_id
      where e.user_id=owner_id and e.event_type='focus_completed'
        and e.created_at>=assignment.starts_at and e.created_at<assignment.ends_at and e.created_at<=server_now
        and f.completed and f.timer_state='completed' and f.duration_seconds>=60
        and f.ended_at>=assignment.starts_at and f.ended_at<assignment.ends_at and f.ended_at<=server_now
      union all
      select e.id,e.subject_id,e.event_type,e.xp
      from public.progression_reward_events e
      join public.tasks t on e.source_id=t.id::text and t.user_id=e.user_id
      where e.user_id=owner_id and e.event_type='task_completed'
        and e.created_at>=assignment.starts_at and e.created_at<assignment.ends_at and e.created_at<=server_now
        and t.status='completed' and t.completed_at>=assignment.starts_at
        and t.completed_at<assignment.ends_at and t.completed_at<=server_now
    )
    select case definition.metric
      when 'focus_minutes' then coalesce(sum(a.xp) filter(where a.event_type='focus_completed'),0)
      when 'completed_tasks' then count(*) filter(where a.event_type='task_completed')
      when 'studied_subjects' then count(distinct s.id)
    end into progress from activity a
    left join public.subjects s on s.id=a.subject_id and s.user_id=owner_id;
    if progress<definition.target then continue; end if;

    insert into public.progression_reward_events(user_id,event_type,source_id,xp,coins,construction_points)
      values(owner_id,'challenge_completed',assignment.id::text,definition.xp,definition.coins,0)
      returning id into event_id;
    update public.progression_profiles set total_xp=total_xp+definition.xp,
      coins=coins+definition.coins,updated_at=server_now where user_id=owner_id;
    update public.user_challenges set completed_at=server_now,reward_event_id=event_id where id=assignment.id;
    construction := focusly_city_internal.process_reward(event_id);
    result := result || jsonb_build_array(jsonb_build_object('id',assignment.id,
      'challengeKey',definition.key,'eventId',event_id,'xp',definition.xp,
      'coins',definition.coins,'cityConstruction',construction));
  end loop;
  return result;
end;
$$;
revoke all on function public.evaluate_progression_challenges() from public,anon;
grant execute on function public.evaluate_progression_challenges() to authenticated;

-- Preserve City authority; allow trusted challenge rewards as construction sources.
create or replace function focusly_city_internal.process_reward(p_event_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  construction jsonb := '[]'::jsonb;
  definition record;
  owned public.user_city_buildings;
  target integer;
  max_target integer;
  receipt jsonb;
  generated_request_id uuid;
begin
  if owner_id is null or not exists (
    select 1 from public.progression_reward_events
    where id = p_event_id and user_id = owner_id
      and event_type in ('focus_completed', 'task_completed', 'challenge_completed')
  ) then
    raise exception 'Owned study reward required' using errcode = '42501';
  end if;
  perform 1 from public.progression_profiles where user_id = owner_id for update;
  if not found then raise exception 'Progression profile required' using errcode = 'P0002'; end if;
  select e.construction into receipt from public.city_auto_events e
    where e.reward_event_id = p_event_id and e.user_id = owner_id;
  if found then return receipt; end if;

  select max(max_level) into max_target from public.city_building_catalog;
  -- One level-first pass: all foundations, then all level-two upgrades, etc.
  -- Each building can advance at most once per round, up to catalog max_level.
  for target in 1..coalesce(max_target, 0) loop
    for definition in select key, max_level from public.city_building_catalog order by auto_priority, key loop
      select * into owned from public.user_city_buildings
        where user_id = owner_id and building_key = definition.key;
      if target > definition.max_level or coalesce(owned.level, 0) <> target - 1 then continue; end if;
      generated_request_id := gen_random_uuid();
      begin
        -- Reuse the sole authority for eligibility, prices, debits and levels.
        receipt := public.city_transaction(
          case when target = 1 then 'build' else 'upgrade' end,
          definition.key, generated_request_id, owned.id, owned.level
        );
      exception when sqlstate '22023' then
        if sqlerrm in ('Building requirement not met', 'Insufficient City balance') then
          continue;
        end if;
        raise;
      end;
      update public.city_transactions set source_reward_event_id = p_event_id
        where user_id = owner_id and city_transactions.request_id = generated_request_id;
      construction := construction || jsonb_build_array(receipt);
    end loop;
  end loop;
  -- Even an empty pass is durable: a duplicate source cannot spend later funds.
  insert into public.city_auto_events(reward_event_id, user_id, construction)
    values (p_event_id, owner_id, construction);
  return construction;
end;
$$;
revoke all on function focusly_city_internal.process_reward(uuid) from public, anon, authenticated;

create or replace function public.claim_focus_progression_reward(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  result jsonb;
  construction jsonb := '[]'::jsonb;
  balance public.progression_profiles;
  challenges jsonb := '[]'::jsonb;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  insert into public.progression_profiles(user_id) values (owner_id) on conflict (user_id) do nothing;
  -- Acquire the same owner lock before reward creation and City spending.
  perform 1 from public.progression_profiles where user_id = owner_id for update;
  result := focusly_city_internal.claim_focus_progression_reward(p_session_id);
  if (result->>'awarded')::boolean then
    construction := focusly_city_internal.process_reward((result->>'eventId')::uuid);
    challenges := public.evaluate_progression_challenges();
  end if;
  select * into strict balance from public.progression_profiles where user_id = owner_id;
  return result || jsonb_build_object('cityConstruction', construction, 'challenges', challenges, 'balances', jsonb_build_object(
    'totalXp', balance.total_xp, 'coins', balance.coins, 'constructionPoints', balance.construction_points));
end;
$$;
create or replace function public.claim_task_progression_reward(p_task_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  result jsonb;
  construction jsonb := '[]'::jsonb;
  balance public.progression_profiles;
  challenges jsonb := '[]'::jsonb;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  insert into public.progression_profiles(user_id) values (owner_id) on conflict (user_id) do nothing;
  perform 1 from public.progression_profiles where user_id = owner_id for update;
  result := focusly_city_internal.claim_task_progression_reward(p_task_id);
  if (result->>'awarded')::boolean then
    construction := focusly_city_internal.process_reward((result->>'eventId')::uuid);
    challenges := public.evaluate_progression_challenges();
  end if;
  select * into strict balance from public.progression_profiles where user_id = owner_id;
  return result || jsonb_build_object('cityConstruction', construction, 'challenges', challenges, 'balances', jsonb_build_object(
    'totalXp', balance.total_xp, 'coins', balance.coins, 'constructionPoints', balance.construction_points));
end;
$$;
revoke all on function public.claim_focus_progression_reward(uuid) from public, anon;
revoke all on function public.claim_task_progression_reward(uuid) from public, anon;
grant execute on function public.claim_focus_progression_reward(uuid) to authenticated;
grant execute on function public.claim_task_progression_reward(uuid) to authenticated;
