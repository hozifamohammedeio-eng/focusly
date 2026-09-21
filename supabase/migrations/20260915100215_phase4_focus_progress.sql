-- Phase 4: retain all historical rows and existing ownership policies.
alter table public.user_settings
  add column focus_minutes integer not null default 25 check (focus_minutes between 5 and 180),
  add column short_break_minutes integer not null default 5 check (short_break_minutes between 1 and 60),
  add column long_break_minutes integer not null default 15 check (long_break_minutes between 1 and 60),
  add column time_zone text check (time_zone is null or private.valid_time_zone(time_zone));

alter table public.focus_sessions
  add column timer_state text check (timer_state in ('running','paused','completed','discarded')),
  add column planned_seconds integer check (planned_seconds between 300 and 10800),
  add column accumulated_seconds integer not null default 0 check (accumulated_seconds between 0 and 10800),
  add column running_since timestamptz,
  add constraint focus_timer_consistency check (timer_state is null or (
    planned_seconds is not null and accumulated_seconds <= planned_seconds and
    ((timer_state='running' and running_since is not null and not completed and ended_at is null)
      or (timer_state='paused' and running_since is null and not completed and ended_at is null)
      or (timer_state='completed' and running_since is null and completed and ended_at is not null and duration_seconds between 60 and planned_seconds)
      or (timer_state='discarded' and running_since is null and not completed and ended_at is not null))
  ));
create unique index focus_one_active_per_user on public.focus_sessions(user_id) where timer_state in ('running','paused');
create index focus_completed_by_end on public.focus_sessions(user_id,ended_at desc) include (duration_seconds,subject_id) where completed and duration_seconds>=60;

-- Row locks serialize lifecycle events across tabs; timestamps are server-owned.
-- p_id is an idempotency key for start. Stale revisions return current state.
create function public.focus_transition(p_action text, p_id uuid default null, p_minutes integer default 25,
  p_subject uuid default null, p_task uuid default null, p_revision timestamptz default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare owner_id uuid:=auth.uid(); stamp timestamptz:=clock_timestamp(); s public.focus_sessions; elapsed integer; finish_at timestamptz;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform 1 from public.profiles where id=owner_id and onboarding_completed for update;
  if not found then raise exception 'Onboarding required' using errcode='42501'; end if;
  if p_action not in ('start','recover','pause','resume','finish','discard') then raise exception 'Invalid action' using errcode='22023'; end if;
  if p_id is not null then select * into s from public.focus_sessions where id=p_id and user_id=owner_id for update; end if;
  if s.id is null and p_action in ('start','recover') then
    select * into s from public.focus_sessions where user_id=owner_id and timer_state in ('running','paused') for update;
  end if;
  if s.id is null and p_action='start' then
    if p_id is null or p_minutes is null or p_minutes not between 5 and 180 then raise exception 'Invalid duration' using errcode='22023'; end if;
    if p_subject is not null and not exists(select 1 from public.subjects where id=p_subject and user_id=owner_id and archived_at is null) then raise exception 'Invalid subject' using errcode='22023'; end if;
    if p_task is not null and not exists(select 1 from public.tasks where id=p_task and user_id=owner_id and status<>'completed') then raise exception 'Invalid task' using errcode='22023'; end if;
    insert into public.focus_sessions(id,user_id,subject_id,task_id,started_at,timer_state,planned_seconds,running_since)
      values(p_id,owner_id,p_subject,p_task,stamp,'running',p_minutes*60,stamp) returning * into s;
  elsif s.id is not null and s.timer_state in ('running','paused') then
    elapsed:=least(s.planned_seconds,s.accumulated_seconds + case when s.timer_state='running' then greatest(0,floor(extract(epoch from stamp-s.running_since))::integer) else 0 end);
    if s.timer_state='paused' and s.updated_at < stamp-interval '7 days' then p_action:='discard'; end if;
    if elapsed>=s.planned_seconds or p_action='discard' or (p_action='finish' and (p_revision is null or p_revision=s.updated_at)) then
      finish_at:=case when elapsed>=s.planned_seconds and s.running_since is not null then s.running_since+make_interval(secs=>s.planned_seconds-s.accumulated_seconds) else stamp end;
      update public.focus_sessions set timer_state=case when p_action='discard' or elapsed<60 then 'discarded' else 'completed' end,
        completed=(p_action<>'discard' and elapsed>=60), duration_seconds=case when p_action='discard' then 0 else elapsed end,
        accumulated_seconds=elapsed,running_since=null,ended_at=finish_at where id=s.id and user_id=owner_id returning * into s;
    elsif p_revision is null or p_revision=s.updated_at then
      if p_action='pause' and s.timer_state='running' then
        update public.focus_sessions set accumulated_seconds=elapsed,running_since=null,timer_state='paused' where id=s.id and user_id=owner_id returning * into s;
      elsif p_action='resume' and s.timer_state='paused' then
        update public.focus_sessions set running_since=stamp,timer_state='running' where id=s.id and user_id=owner_id returning * into s;
      end if;
    end if;
  elsif s.id is null and p_action<>'recover' then raise exception 'Session unavailable' using errcode='P0002';
  end if;
  return jsonb_build_object('session',case when s.id is null then null else to_jsonb(s) end,'serverNow',clock_timestamp());
end;
$$;
revoke all on function public.focus_transition(text,uuid,integer,uuid,uuid,timestamptz) from public,anon;
grant execute on function public.focus_transition(text,uuid,integer,uuid,uuid,timestamptz) to authenticated;

-- One aggregate payload, not lifetime rows in the browser. Week uses a bounded
-- timestamp range. Study days are assigned to completion day in saved time zone.
create function public.focus_progress() returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare owner_id uuid:=auth.uid(); zone text; today date; first_day date; result jsonb; streak integer:=0; cursor_day date;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select coalesce(time_zone,'UTC') into zone from public.user_settings where user_id=owner_id;
  zone:=coalesce(zone,'UTC'); today:=(now() at time zone zone)::date;
  first_day:=today-((extract(dow from today)::integer+1)%7);
  cursor_day:=today;
  if not exists(select 1 from public.focus_sessions where user_id=owner_id and completed and duration_seconds>=60 and ended_at>=cursor_day::timestamp at time zone zone and ended_at<(cursor_day+1)::timestamp at time zone zone) then cursor_day:=today-1; end if;
  while exists(select 1 from public.focus_sessions where user_id=owner_id and completed and duration_seconds>=60 and ended_at>=cursor_day::timestamp at time zone zone and ended_at<(cursor_day+1)::timestamp at time zone zone) loop
    streak:=streak+1; cursor_day:=cursor_day-1;
  end loop;
  select jsonb_build_object('zone',zone,'today',today,'weekStart',first_day,'streak',streak,
    'totalSeconds',(select coalesce(sum(duration_seconds),0) from public.focus_sessions where user_id=owner_id and completed and duration_seconds>=60 and ended_at<=now()),
    'totalSessions',(select count(*) from public.focus_sessions where user_id=owner_id and completed and duration_seconds>=60 and ended_at<=now()),
    'days',(select coalesce(jsonb_agg(to_jsonb(d)),'[]') from (select (ended_at at time zone zone)::date as day,sum(duration_seconds) as seconds,count(*) as sessions from public.focus_sessions where user_id=owner_id and completed and duration_seconds>=60 and ended_at>=first_day::timestamp at time zone zone and ended_at<(first_day+7)::timestamp at time zone zone and ended_at<=now() group by 1 order by 1) d),
    'subjects',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select subject_id,sum(duration_seconds) as seconds from public.focus_sessions where user_id=owner_id and completed and duration_seconds>=60 and ended_at<=now() group by subject_id order by seconds desc,subject_id) x),
    'recent',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select id,subject_id,duration_seconds,ended_at from public.focus_sessions where user_id=owner_id and completed and duration_seconds>=60 and ended_at<=now() order by ended_at desc,id limit 8) r)) into result;
  return result;
end;
$$;
revoke all on function public.focus_progress() from public,anon;
grant execute on function public.focus_progress() to authenticated;
