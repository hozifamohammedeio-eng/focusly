-- LOCAL ONLY. Automatic construction runs after a newly awarded Focus/Task claim.
-- No active application route depends on these objects yet.
alter table public.city_building_catalog add column auto_priority integer;
update public.city_building_catalog set auto_priority = case key
  when 'knowledge_center' then 1 when 'focus_tower' then 2
  when 'library_district' then 3 when 'science_lab' then 4
  when 'language_academy' then 5 when 'planner_hall' then 6 end;
alter table public.city_building_catalog alter column auto_priority set not null;
alter table public.city_building_catalog add constraint city_auto_priority_unique unique (auto_priority);
alter table public.city_building_catalog add constraint city_auto_priority_positive check (auto_priority > 0);

create table public.city_auto_events (
  reward_event_id uuid primary key references public.progression_reward_events(id) on delete cascade,
  user_id uuid not null references public.progression_profiles(user_id) on delete cascade,
  construction jsonb not null,
  processed_at timestamptz not null default now()
);
create index city_auto_events_owner_idx on public.city_auto_events(user_id, processed_at);
alter table public.city_auto_events enable row level security;
revoke all on public.city_auto_events from public, anon, authenticated;
grant select on public.city_auto_events to authenticated;
create policy city_auto_events_read_own on public.city_auto_events
  for select to authenticated using ((select auth.uid()) = user_id);

alter table public.city_transactions add column source_reward_event_id uuid
  references public.progression_reward_events(id) on delete set null;
create index city_transactions_source_event_idx on public.city_transactions(source_reward_event_id)
  where source_reward_event_id is not null;

-- Keep the already tested reward logic intact, but remove direct API access to
-- the core routines. Only the public wrappers below can invoke them.
create schema focusly_city_internal;
revoke all on schema focusly_city_internal from public, anon, authenticated;
alter function public.claim_focus_progression_reward(uuid) set schema focusly_city_internal;
alter function public.claim_task_progression_reward(uuid) set schema focusly_city_internal;
revoke all on function focusly_city_internal.claim_focus_progression_reward(uuid) from public, anon, authenticated;
revoke all on function focusly_city_internal.claim_task_progression_reward(uuid) from public, anon, authenticated;

create function focusly_city_internal.process_reward(p_event_id uuid)
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
      and event_type in ('focus_completed', 'task_completed')
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

create function public.claim_focus_progression_reward(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  result jsonb;
  construction jsonb := '[]'::jsonb;
  balance public.progression_profiles;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  insert into public.progression_profiles(user_id) values (owner_id) on conflict (user_id) do nothing;
  -- Acquire the same owner lock before reward creation and City spending.
  perform 1 from public.progression_profiles where user_id = owner_id for update;
  result := focusly_city_internal.claim_focus_progression_reward(p_session_id);
  if (result->>'awarded')::boolean then
    construction := focusly_city_internal.process_reward((result->>'eventId')::uuid);
  end if;
  select * into strict balance from public.progression_profiles where user_id = owner_id;
  return result || jsonb_build_object('cityConstruction', construction, 'balances', jsonb_build_object(
    'totalXp', balance.total_xp, 'coins', balance.coins, 'constructionPoints', balance.construction_points));
end;
$$;
create function public.claim_task_progression_reward(p_task_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  result jsonb;
  construction jsonb := '[]'::jsonb;
  balance public.progression_profiles;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  insert into public.progression_profiles(user_id) values (owner_id) on conflict (user_id) do nothing;
  perform 1 from public.progression_profiles where user_id = owner_id for update;
  result := focusly_city_internal.claim_task_progression_reward(p_task_id);
  if (result->>'awarded')::boolean then
    construction := focusly_city_internal.process_reward((result->>'eventId')::uuid);
  end if;
  select * into strict balance from public.progression_profiles where user_id = owner_id;
  return result || jsonb_build_object('cityConstruction', construction, 'balances', jsonb_build_object(
    'totalXp', balance.total_xp, 'coins', balance.coins, 'constructionPoints', balance.construction_points));
end;
$$;
revoke all on function public.claim_focus_progression_reward(uuid) from public, anon;
revoke all on function public.claim_task_progression_reward(uuid) from public, anon;
grant execute on function public.claim_focus_progression_reward(uuid) to authenticated;
grant execute on function public.claim_task_progression_reward(uuid) to authenticated;
