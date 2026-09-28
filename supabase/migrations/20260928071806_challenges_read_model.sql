-- Local only. Shared canonical evidence calculation for evaluation and reads.
-- No client-supplied owner, progress, reward or clock is accepted by the public RPC.
create function focusly_challenge_internal.progress(
  p_metric text, p_start timestamptz, p_end timestamptz, p_now timestamptz
) returns bigint language sql stable set search_path='' as $$
  with activity as (
    select e.id,e.subject_id,e.event_type,e.xp
    from public.progression_reward_events e
    join public.focus_sessions f on e.source_id=f.id::text and f.user_id=e.user_id
    where e.user_id=(select auth.uid()) and e.event_type='focus_completed'
      and e.created_at>=p_start and e.created_at<p_end and e.created_at<=p_now
      and f.completed and f.timer_state='completed' and f.duration_seconds>=60
      and f.ended_at>=p_start and f.ended_at<p_end and f.ended_at<=p_now
    union all
    select e.id,e.subject_id,e.event_type,e.xp
    from public.progression_reward_events e
    join public.tasks t on e.source_id=t.id::text and t.user_id=e.user_id
    where e.user_id=(select auth.uid()) and e.event_type='task_completed'
      and e.created_at>=p_start and e.created_at<p_end and e.created_at<=p_now
      and t.status='completed' and t.completed_at>=p_start
      and t.completed_at<p_end and t.completed_at<=p_now
  )
  select case p_metric
    when 'focus_minutes' then coalesce(sum(a.xp) filter(where a.event_type='focus_completed'),0)
    when 'completed_tasks' then count(*) filter(where a.event_type='task_completed')
    when 'studied_subjects' then count(distinct s.id)
  end from activity a
  left join public.subjects s on s.id=a.subject_id and s.user_id=(select auth.uid());
$$;
revoke all on function focusly_challenge_internal.progress(text,timestamptz,timestamptz,timestamptz)
  from public,anon,authenticated;

-- The existing evaluator changes only to call the shared evidence calculation.
create or replace function public.evaluate_progression_challenges()
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
      if exists(select 1 from public.user_challenges where user_id=owner_id
        and challenge_key=definition.key and starts_at<window_end and ends_at>window_start) then continue; end if;
      insert into public.user_challenges(user_id,challenge_key,time_zone,starts_at,ends_at)
        values(owner_id,definition.key,zone,window_start,window_end) returning * into assignment;
    end if;
    if assignment.completed_at is not null then continue; end if;
    progress := focusly_challenge_internal.progress(definition.metric,assignment.starts_at,assignment.ends_at,server_now);
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

create function public.get_challenge_progress()
returns table(challenge_key text,progress bigint,target integer,completed boolean,starts_at timestamptz,ends_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare
  owner_id uuid := auth.uid();
  server_now timestamptz := statement_timestamp();
  zone text;
  definition public.challenge_catalog;
  assignment public.user_challenges;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select coalesce(time_zone,'UTC') into zone from public.user_settings where user_id=owner_id;
  zone := coalesce(zone,'UTC');
  for definition in select * from public.challenge_catalog order by key loop
    select u.* into assignment from public.user_challenges u
      where u.user_id=owner_id and u.challenge_key=definition.key
        and u.starts_at<=server_now and u.ends_at>server_now order by u.starts_at desc limit 1;
    if found then
      starts_at := assignment.starts_at;
      ends_at := assignment.ends_at;
    else
      -- Preview the same current period without persisting an assignment.
      select p.starts_at,p.ends_at into starts_at,ends_at
        from focusly_challenge_internal.period(definition.kind,zone,server_now) p;
      -- Respect the evaluator's gap after timezone changes; no invented progress.
      if exists(select 1 from public.user_challenges u where u.user_id=owner_id
        and u.challenge_key=definition.key and u.starts_at<get_challenge_progress.ends_at
        and u.ends_at>get_challenge_progress.starts_at) then continue; end if;
    end if;
    challenge_key := definition.key;
    target := definition.target;
    completed := assignment.completed_at is not null;
    -- Awarded completion remains durable even if its original activity is edited.
    progress := case when completed then target else least(target,
      focusly_challenge_internal.progress(definition.metric,starts_at,ends_at,server_now)) end;
    return next;
  end loop;
end;
$$;
revoke all on function public.get_challenge_progress() from public,anon;
grant execute on function public.get_challenge_progress() to authenticated;
