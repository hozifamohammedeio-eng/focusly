-- Atomic, owner-scoped save of a validated AI preview into the existing Tasks and Planner model.
-- Nothing is backfilled or changed for existing rows. The task link is nullable for legacy blocks.
alter table public.study_blocks add column task_id uuid;
alter table public.study_blocks add constraint study_blocks_task_owner_fk
  foreign key (task_id, user_id) references public.tasks(id, user_id) on delete set null (task_id);
create index study_blocks_task_id_idx on public.study_blocks(task_id) where task_id is not null;

create table private.ai_plan_saves (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  payload_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(user_id, request_id)
);
alter table private.ai_plan_saves enable row level security;
revoke all on private.ai_plan_saves from public, anon, authenticated;

create function public.save_ai_weekly_plan(p_request_id uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  saved private.ai_plan_saves%rowtype;
  zone text;
  expected_zone text;
  first_day date;
  day_value date;
  entry jsonb;
  work jsonb;
  item_map jsonb := '{}'::jsonb;
  item_id uuid;
  start_at timestamptz;
  stop_at timestamptz;
  ranges tstzrange[] := array[]::tstzrange[];
  result jsonb;
  session_count integer := 0;
  task_count integer := 0;
  daily_total integer;
  daily_capacity integer;
  hash text := md5(p_payload::text);
begin
  if owner_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_request_id is null or p_payload is null or pg_catalog.octet_length(p_payload::text) > 100000 or jsonb_typeof(p_payload) <> 'object' or
     jsonb_typeof(p_payload->'input') <> 'object' or jsonb_typeof(p_payload->'plan') <> 'object' or
     jsonb_typeof(p_payload#>'{plan,items}') <> 'array' or jsonb_typeof(p_payload#>'{plan,sessions}') <> 'array' or
     jsonb_typeof(p_payload#>'{input,fixed}') <> 'array' or jsonb_typeof(p_payload#>'{input,daysOff}') <> 'array' then
    raise exception 'Invalid plan' using errcode='22023';
  end if;
  -- A transaction lock serializes retries for this owner. Existing writes are serialized
  -- by the table lock before conflict checks, so no partial or silently overwritten plan.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text, 613));
  select * into saved from private.ai_plan_saves where user_id=owner_id and request_id=p_request_id;
  if found then
    if saved.payload_hash <> hash then raise exception 'Request reused with different plan' using errcode='22023'; end if;
    return saved.result || '{"alreadySaved":true}'::jsonb;
  end if;
  select coalesce(s.time_zone, 'UTC') into expected_zone from public.user_settings s where s.user_id=owner_id;
  if expected_zone is null or not exists(select 1 from public.profiles p where p.id=owner_id and p.onboarding_completed) then
    raise exception 'Student unavailable' using errcode='42501';
  end if;
  zone := p_payload#>>'{input,zone}';
  first_day := (p_payload#>>'{input,weekStart}')::date;
  daily_capacity := (p_payload#>>'{input,dailyMinutes}')::integer;
  if zone is distinct from expected_zone or first_day is null or extract(dow from first_day) <> 6 or
     first_day < (now() at time zone zone)::date - 7 or first_day > (now() at time zone zone)::date + 35 or
     daily_capacity < 30 or daily_capacity > 480 or
     jsonb_array_length(p_payload#>'{plan,items}') > 50 or
     jsonb_array_length(p_payload#>'{plan,sessions}') > 70 or
     jsonb_array_length(p_payload#>'{input,fixed}') > 20 then
    raise exception 'Invalid plan constraints' using errcode='22023';
  end if;
  lock table public.study_blocks in share row exclusive mode;
  for entry in select value from pg_catalog.jsonb_array_elements((p_payload#>'{input,fixed}') || (p_payload#>'{plan,sessions}')) loop
    day_value := (entry->>'date')::date;
    if day_value < first_day or day_value > first_day+6 or
       pg_catalog.char_length(entry->>'title') not between 1 and 200 or
       (entry->>'start') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or
       (entry->>'end') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or
       entry->>'startInstant' is null or entry->>'endInstant' is null or
       not exists(select 1 from public.subjects s where s.id=(entry->>'subjectId')::uuid and s.user_id=owner_id and s.archived_at is null) then
      raise exception 'Invalid plan slot' using errcode='22023';
    end if;
    start_at := (entry->>'startInstant')::timestamptz;
    stop_at := (entry->>'endInstant')::timestamptz;
    if stop_at <= start_at or stop_at-start_at > interval '12 hours' or
       (start_at at time zone zone)::date <> day_value or
       to_char(start_at at time zone zone, 'HH24:MI') <> entry->>'start' or
       to_char(stop_at at time zone zone, 'HH24:MI') <> entry->>'end' or
       exists(select 1 from pg_catalog.unnest(ranges) r where r && tstzrange(start_at,stop_at,'[)')) then
      raise exception 'Invalid or overlapping plan slot' using errcode='23P01';
    end if;
    if exists(select 1 from public.study_blocks b where b.user_id=owner_id and (
      (not b.repeat_weekly and tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(start_at,stop_at,'[)')) or
      (b.repeat_weekly and exists(
        select 1 from pg_catalog.generate_series(-1,1) d
        where ((start_at at time zone b.time_zone)::date + d) >= (b.starts_at at time zone b.time_zone)::date
          and extract(dow from ((start_at at time zone b.time_zone)::date + d)) = extract(dow from b.starts_at at time zone b.time_zone)
          and tstzrange(
            (((start_at at time zone b.time_zone)::date + d) + (b.starts_at at time zone b.time_zone)::time) at time zone b.time_zone,
            ((((start_at at time zone b.time_zone)::date + d) + (b.starts_at at time zone b.time_zone)::time) at time zone b.time_zone) + (b.ends_at-b.starts_at), '[)'
          ) && tstzrange(start_at,stop_at,'[)')
      ))
    )) then raise exception 'Existing Planner conflict' using errcode='23P01'; end if;
    ranges := pg_catalog.array_append(ranges, tstzrange(start_at,stop_at,'[)'));
    if entry ? 'workItemId' then
      if (p_payload#>'{input,daysOff}') ? day_value::text or
         not exists(select 1 from pg_catalog.jsonb_array_elements(p_payload#>'{plan,items}') i where i->>'id'=entry->>'workItemId' and i->>'subjectId'=entry->>'subjectId') or
         stop_at-start_at > interval '120 minutes' then
        raise exception 'Invalid study session' using errcode='22023';
      end if;
      select coalesce(sum(extract(epoch from ((s->>'end')::time-(s->>'start')::time))/60),0)::integer into daily_total
      from pg_catalog.jsonb_array_elements(p_payload#>'{plan,sessions}') s where s->>'date'=day_value::text;
      if daily_total > daily_capacity then raise exception 'Daily capacity exceeded' using errcode='22023'; end if;
    end if;
  end loop;
  -- Work items are one authoritative Task each. Scheduled study blocks reference that task.
  for work in select value from pg_catalog.jsonb_array_elements(p_payload#>'{plan,items}') loop
    if work->>'id' is null or item_map ? (work->>'id') or
       pg_catalog.char_length(work->>'title') not between 1 and 200 or
       not exists(select 1 from public.subjects s where s.id=(work->>'subjectId')::uuid and s.user_id=owner_id and s.archived_at is null) or
       (select coalesce(sum(extract(epoch from ((s->>'end')::time-(s->>'start')::time))/60),0)::integer
         from pg_catalog.jsonb_array_elements(p_payload#>'{plan,sessions}') s where s->>'workItemId'=work->>'id') < (work->>'estimatedMinutes')::integer then
      raise exception 'Invalid work item' using errcode='22023';
    end if;
    insert into public.tasks(user_id,subject_id,title,notes,priority,estimated_minutes,task_date,due_on)
    values(owner_id,(work->>'subjectId')::uuid,work->>'title',
      case when work->>'isBacklog'='true' then 'AI Planner · backlog' else null end,
      (work->>'priority')::public.task_priority, (work->>'estimatedMinutes')::integer,
      (select min((s->>'date')::date) from pg_catalog.jsonb_array_elements(p_payload#>'{plan,sessions}') s where s->>'workItemId'=work->>'id'),
      nullif(work->>'deadline','')::date)
    returning id into item_id;
    item_map := item_map || pg_catalog.jsonb_build_object(work->>'id', item_id::text);
    task_count := task_count+1;
  end loop;
  for entry in select value from pg_catalog.jsonb_array_elements((p_payload#>'{input,fixed}') || (p_payload#>'{plan,sessions}')) loop
    day_value := (entry->>'date')::date;
    start_at := (entry->>'startInstant')::timestamptz;
    stop_at := (entry->>'endInstant')::timestamptz;
    insert into public.study_blocks(user_id,subject_id,task_id,title,starts_at,ends_at,notes,repeat_weekly,time_zone)
    values(owner_id,(entry->>'subjectId')::uuid,
      case when entry ? 'workItemId' then (item_map->>(entry->>'workItemId'))::uuid else null end,
      entry->>'title',start_at,stop_at,
      case when entry ? 'workItemId' then 'AI Planner' else
        'AI Planner · fixed commitment' || case when coalesce(entry->>'notes','') <> '' then E'\n' || pg_catalog.left(entry->>'notes',1000) else '' end end,
      false,zone);
    session_count := session_count+1;
  end loop;
  result := pg_catalog.jsonb_build_object('tasks',task_count,'sessions',session_count,'alreadySaved',false);
  insert into private.ai_plan_saves(user_id,request_id,payload_hash,result) values(owner_id,p_request_id,hash,result);
  return result;
end;
$$;
revoke all on function public.save_ai_weekly_plan(uuid,jsonb) from public, anon;
grant execute on function public.save_ai_weekly_plan(uuid,jsonb) to authenticated;
