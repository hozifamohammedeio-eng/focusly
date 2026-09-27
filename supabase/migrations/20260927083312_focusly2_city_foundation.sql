-- LOCAL ONLY. Additive City foundation; active routes remain disconnected.
-- The SQL catalog is authoritative. catalog.json is a tested presentation mirror.
create table public.city_building_catalog (
  key text primary key,
  max_level integer not null check (max_level between 1 and 100),
  coins integer not null check (coins > 0),
  construction_points integer not null check (construction_points > 0),
  metric text not null check (metric in ('global_xp', 'focus_minutes', 'subject_xp', 'completed_tasks')),
  threshold integer not null check (threshold > 0)
);
insert into public.city_building_catalog values
  ('knowledge_center', 3, 10, 5, 'global_xp', 100),
  ('focus_tower', 3, 5, 5, 'focus_minutes', 25),
  ('library_district', 3, 10, 5, 'subject_xp', 100),
  ('science_lab', 3, 15, 10, 'subject_xp', 225),
  ('language_academy', 3, 15, 10, 'subject_xp', 225),
  ('planner_hall', 3, 5, 2, 'completed_tasks', 5);
-- Subjects have no trusted category field. Science/language deliberately use
-- generic subject XP, never names or client-supplied classifications.

create table public.user_city_buildings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.progression_profiles(user_id) on delete cascade,
  building_key text not null references public.city_building_catalog(key),
  level integer not null check (level between 1 and 100),
  built_at timestamptz not null default now(),
  upgraded_at timestamptz,
  unique (user_id, building_key)
);

-- Immutable to API clients; records spending separately from earned rewards.
create table public.city_transactions (
  user_id uuid not null references public.progression_profiles(user_id) on delete cascade,
  request_id uuid not null,
  building_key text not null references public.city_building_catalog(key),
  target_level integer not null check (target_level between 1 and 100),
  coins integer not null check (coins > 0),
  construction_points integer not null check (construction_points > 0),
  request jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id),
  unique (user_id, building_key, target_level)
);

alter table public.city_building_catalog enable row level security;
alter table public.user_city_buildings enable row level security;
alter table public.city_transactions enable row level security;
revoke all on public.city_building_catalog, public.user_city_buildings, public.city_transactions from public, anon, authenticated;
grant select on public.city_building_catalog, public.user_city_buildings, public.city_transactions to authenticated;
create policy city_catalog_read on public.city_building_catalog for select to authenticated using (true);
create policy city_buildings_read_own on public.user_city_buildings for select to authenticated using ((select auth.uid()) = user_id);
create policy city_transactions_read_own on public.city_transactions for select to authenticated using ((select auth.uid()) = user_id);

-- One transaction endpoint for both operations. No owner, costs, balances,
-- requirements or resulting level can be supplied by callers.
create function public.city_transaction(
  p_action text,
  p_building_key text,
  p_request_id uuid,
  p_building_id uuid default null,
  p_expected_level integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  definition public.city_building_catalog;
  owned public.user_city_buildings;
  balance public.progression_profiles;
  prior public.city_transactions;
  payload jsonb;
  response jsonb;
  next_level integer;
  evidence bigint;
  coin_cost bigint;
  point_cost bigint;
begin
  if owner_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('build', 'upgrade') or p_request_id is null or p_building_key is null then
    raise exception 'Invalid City request' using errcode = '22023';
  end if;
  if (p_action = 'build' and (p_building_id is not null or p_expected_level is not null))
    or (p_action = 'upgrade' and (p_building_id is null or p_expected_level is null)) then
    raise exception 'Invalid City operation arguments' using errcode = '22023';
  end if;
  payload := jsonb_build_object('action', p_action, 'key', p_building_key,
    'buildingId', p_building_id, 'expectedLevel', p_expected_level);

  insert into public.progression_profiles(user_id) values (owner_id) on conflict (user_id) do nothing;
  -- Shared per-owner lock serializes spending across every building. Reward
  -- UPDATEs acquire this same row lock, preventing lost balance updates.
  select * into strict balance from public.progression_profiles where user_id = owner_id for update;
  select * into prior from public.city_transactions where user_id = owner_id and request_id = p_request_id;
  if found then
    if prior.request <> payload then
      raise exception 'Request ID already used for another operation' using errcode = '22023';
    end if;
    return prior.result;
  end if;

  select * into definition from public.city_building_catalog where key = p_building_key;
  if not found then raise exception 'Unknown building' using errcode = '22023'; end if;
  if p_action = 'build' then
    if exists (select 1 from public.user_city_buildings where user_id = owner_id and building_key = p_building_key) then
      raise exception 'Building already built' using errcode = '22023';
    end if;
    next_level := 1;
  else
    select * into owned from public.user_city_buildings
      where id = p_building_id and user_id = owner_id and building_key = p_building_key for update;
    if not found then raise exception 'Building unavailable' using errcode = '42501'; end if;
    if owned.level <> p_expected_level then raise exception 'Stale building level' using errcode = '22023'; end if;
    next_level := owned.level + 1;
  end if;
  if next_level > definition.max_level then raise exception 'Maximum building level' using errcode = '22023'; end if;

  -- Read only canonical owner-scoped study data, following mastery/achievement conventions.
  case definition.metric
    when 'global_xp' then
      select coalesce(sum(xp), 0) into evidence from public.progression_reward_events where user_id = owner_id;
    when 'focus_minutes' then
      select coalesce(sum(floor(duration_seconds / 60.0)), 0) into evidence from public.focus_sessions
        where user_id = owner_id and completed and ended_at is not null and duration_seconds >= 60;
    when 'completed_tasks' then
      select count(*) into evidence from public.tasks where user_id = owner_id and status = 'completed' and completed_at is not null;
    when 'subject_xp' then
      select coalesce(max(s.total), 0) into evidence from (
        select sum(e.xp) as total from public.progression_reward_events e
        join public.subjects subject on subject.id = e.subject_id and subject.user_id = e.user_id
        where e.user_id = owner_id group by e.subject_id
      ) s;
    else raise exception 'Unsupported requirement' using errcode = '22023';
  end case;
  if evidence < definition.threshold::bigint * next_level then
    raise exception 'Building requirement not met' using errcode = '22023';
  end if;
  coin_cost := definition.coins::bigint * next_level;
  point_cost := definition.construction_points::bigint * next_level;
  if balance.coins < coin_cost or balance.construction_points < point_cost then
    raise exception 'Insufficient City balance' using errcode = '22023';
  end if;
  update public.progression_profiles set coins = coins - coin_cost,
    construction_points = construction_points - point_cost, updated_at = clock_timestamp()
    where user_id = owner_id returning * into balance;
  if p_action = 'build' then
    insert into public.user_city_buildings(user_id, building_key, level)
      values (owner_id, p_building_key, next_level) returning * into owned;
  else
    update public.user_city_buildings set level = next_level, upgraded_at = clock_timestamp()
      where id = owned.id and user_id = owner_id returning * into owned;
  end if;
  response := jsonb_build_object('building', to_jsonb(owned), 'cost', jsonb_build_object(
    'coins', coin_cost, 'constructionPoints', point_cost), 'balances', jsonb_build_object(
    'coins', balance.coins, 'constructionPoints', balance.construction_points));
  insert into public.city_transactions(user_id, request_id, building_key, target_level, coins, construction_points, request, result)
    values (owner_id, p_request_id, p_building_key, next_level, coin_cost, point_cost, payload, response);
  return response;
end;
$$;
revoke all on function public.city_transaction(text, text, uuid, uuid, integer) from public, anon;
grant execute on function public.city_transaction(text, text, uuid, uuid, integer) to authenticated;
