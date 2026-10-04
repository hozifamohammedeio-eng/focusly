-- Focusly study companion V1. Additive; no existing rows or policies are changed.
create table public.study_companion_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  companion_name text not null check (char_length(btrim(companion_name)) between 1 and 40),
  enabled boolean not null default true,
  auto_greeting_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger study_companion_preferences_set_updated_at before update on public.study_companion_preferences
  for each row execute function private.set_updated_at();
alter table public.study_companion_preferences enable row level security;
revoke all on public.study_companion_preferences from public, anon, authenticated;
grant select, insert, update, delete on public.study_companion_preferences to authenticated;
create policy study_companion_preferences_select_own on public.study_companion_preferences
  for select to authenticated using ((select auth.uid()) = user_id);
create policy study_companion_preferences_insert_own on public.study_companion_preferences
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy study_companion_preferences_update_own on public.study_companion_preferences
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy study_companion_preferences_delete_own on public.study_companion_preferences
  for delete to authenticated using ((select auth.uid()) = user_id);

create table public.study_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  body text check (body is null or char_length(body) <= 500),
  remind_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'delivered', 'cancelled')),
  related_task_id uuid,
  related_subject_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, request_id),
  constraint study_reminders_task_owner_fk foreign key (related_task_id, user_id)
    references public.tasks(id, user_id) on delete set null (related_task_id),
  constraint study_reminders_subject_owner_fk foreign key (related_subject_id, user_id)
    references public.subjects(id, user_id) on delete set null (related_subject_id)
);
create index study_reminders_due_idx on public.study_reminders(user_id, remind_at)
  where status = 'scheduled';
create trigger study_reminders_set_updated_at before update on public.study_reminders
  for each row execute function private.set_updated_at();
alter table public.study_reminders enable row level security;
revoke all on public.study_reminders from public, anon, authenticated;
grant select, insert, update, delete on public.study_reminders to authenticated;
create policy study_reminders_select_own on public.study_reminders
  for select to authenticated using ((select auth.uid()) = user_id);
create policy study_reminders_insert_own on public.study_reminders
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy study_reminders_update_own on public.study_reminders
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy study_reminders_delete_own on public.study_reminders
  for delete to authenticated using ((select auth.uid()) = user_id);

-- A reminder is claimed only when its owner has an active app session. This
-- does not promise delivery while every Focusly tab is closed.
create function public.claim_due_study_reminders()
returns setof public.study_reminders language sql security invoker set search_path = '' as $$
  with due as (
    select id from public.study_reminders
    where user_id = (select auth.uid()) and status = 'scheduled' and remind_at <= now()
    order by remind_at, id limit 5 for update skip locked
  )
  update public.study_reminders r set status = 'delivered'
  from due where r.id = due.id and r.user_id = (select auth.uid())
  returning r.*;
$$;
revoke all on function public.claim_due_study_reminders() from public, anon;
grant execute on function public.claim_due_study_reminders() to authenticated;

-- Apply a short day proposal atomically. The caller supplies only existing
-- owner-owned Tasks; the function derives the owner from the verified JWT.
-- Keep the privileged implementation in its own unexposed schema. Granting
-- USAGE here does not make other functions in the existing private schema
-- callable by authenticated users.
create schema companion_private;
revoke all on schema companion_private from public, anon, authenticated;
grant usage on schema companion_private to authenticated;

create table companion_private.study_companion_plan_saves (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  payload_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);
alter table companion_private.study_companion_plan_saves enable row level security;
revoke all on companion_private.study_companion_plan_saves from public, anon, authenticated;

create function companion_private.apply_companion_day_plan_impl(p_request_id uuid, p_blocks jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  saved companion_private.study_companion_plan_saves%rowtype;
  zone text;
  entry jsonb;
  task_row public.tasks%rowtype;
  start_at timestamptz;
  stop_at timestamptz;
  ranges tstzrange[] := array[]::tstzrange[];
  result jsonb;
  payload_hash text := pg_catalog.md5(p_blocks::text);
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_request_id is null or p_blocks is null or pg_catalog.jsonb_typeof(p_blocks) <> 'array' or
     pg_catalog.jsonb_array_length(p_blocks) not between 1 and 3 or
     pg_catalog.octet_length(p_blocks::text) > 10000 then
    raise exception 'Invalid day plan' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text, 814));
  select * into saved from companion_private.study_companion_plan_saves
    where user_id = owner_id and request_id = p_request_id;
  if found then
    if saved.payload_hash <> payload_hash then raise exception 'Request reused' using errcode = '22023'; end if;
    return saved.result || '{"alreadySaved":true}'::jsonb;
  end if;
  select coalesce(s.time_zone, 'UTC') into zone from public.user_settings s where s.user_id = owner_id;
  if zone is null or not exists(select 1 from public.profiles p where p.id = owner_id and p.onboarding_completed) then
    raise exception 'Student unavailable' using errcode = '42501';
  end if;
  lock table public.study_blocks in share row exclusive mode;
  for entry in select value from pg_catalog.jsonb_array_elements(p_blocks) loop
    if pg_catalog.jsonb_typeof(entry) <> 'object' or
       (select count(*) from pg_catalog.jsonb_object_keys(entry)) <> 4 or
       entry->>'taskId' is null or entry->>'title' is null or
       entry->>'startsAt' is null or entry->>'endsAt' is null or
       pg_catalog.char_length(pg_catalog.btrim(entry->>'title')) not between 1 and 200 then
      raise exception 'Invalid day block' using errcode = '22023';
    end if;
    select * into task_row from public.tasks t
      where t.id = (entry->>'taskId')::uuid and t.user_id = owner_id and t.status <> 'completed';
    if not found or task_row.title <> entry->>'title' then
      raise exception 'Task unavailable' using errcode = '42501';
    end if;
    start_at := (entry->>'startsAt')::timestamptz;
    stop_at := (entry->>'endsAt')::timestamptz;
    if start_at < now() - interval '5 minutes' or
       (start_at at time zone zone)::date <> (now() at time zone zone)::date or
       stop_at <= start_at or stop_at - start_at > interval '120 minutes' or
       stop_at - start_at < interval '15 minutes' or
       (stop_at at time zone zone)::date <> (start_at at time zone zone)::date or
       exists(select 1 from pg_catalog.unnest(ranges) r where r && pg_catalog.tstzrange(start_at, stop_at, '[)')) or
       exists(select 1 from public.study_blocks b where b.user_id = owner_id and (
         (not b.repeat_weekly and pg_catalog.tstzrange(b.starts_at,b.ends_at,'[)') && pg_catalog.tstzrange(start_at,stop_at,'[)')) or
         (b.repeat_weekly and exists(
           select 1 from pg_catalog.generate_series(-1,1) d
           where ((start_at at time zone b.time_zone)::date + d) >= (b.starts_at at time zone b.time_zone)::date
             and extract(dow from ((start_at at time zone b.time_zone)::date + d)) = extract(dow from b.starts_at at time zone b.time_zone)
             and pg_catalog.tstzrange(
               (((start_at at time zone b.time_zone)::date + d) + (b.starts_at at time zone b.time_zone)::time) at time zone b.time_zone,
               ((((start_at at time zone b.time_zone)::date + d) + (b.starts_at at time zone b.time_zone)::time) at time zone b.time_zone) + (b.ends_at-b.starts_at), '[)'
             ) && pg_catalog.tstzrange(start_at,stop_at,'[)')
         ))
       )) then raise exception 'Day plan conflict' using errcode = '23P01'; end if;
    ranges := pg_catalog.array_append(ranges, pg_catalog.tstzrange(start_at, stop_at, '[)'));
    insert into public.study_blocks(user_id, task_id, subject_id, title, starts_at, ends_at, repeat_weekly, time_zone)
      values(owner_id, task_row.id, task_row.subject_id, task_row.title, start_at, stop_at, false, zone);
  end loop;
  result := pg_catalog.jsonb_build_object('sessions', pg_catalog.jsonb_array_length(p_blocks), 'alreadySaved', false);
  insert into companion_private.study_companion_plan_saves(user_id, request_id, payload_hash, result)
    values(owner_id, p_request_id, payload_hash, result);
  return result;
end;
$$;
revoke all on function companion_private.apply_companion_day_plan_impl(uuid, jsonb) from public, anon, authenticated;
grant execute on function companion_private.apply_companion_day_plan_impl(uuid, jsonb) to authenticated;

-- Retain the existing PostgREST RPC name, but expose only an invoker wrapper.
-- The private function performs the owner checks and the atomic write.
create function public.apply_companion_day_plan(p_request_id uuid, p_blocks jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select companion_private.apply_companion_day_plan_impl(p_request_id, p_blocks);
$$;
revoke all on function public.apply_companion_day_plan(uuid, jsonb) from public, anon;
grant execute on function public.apply_companion_day_plan(uuid, jsonb) to authenticated;
