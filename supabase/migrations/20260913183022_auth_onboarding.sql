-- Phase 1 is preserved. Draft answers remain private under profiles RLS.
alter table public.profiles
  add column onboarding_step integer not null default 1 check (onboarding_step between 1 and 6),
  add column onboarding_subjects text[] not null default '{}';

create or replace function private.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare display_name text := btrim(new.raw_user_meta_data->>'display_name');
begin
  -- Metadata is only an initial display name, never an authorization source.
  if display_name is null or char_length(display_name) not between 1 and 80 or display_name ~ '[[:cntrl:]]' then display_name := null; end if;
  insert into public.profiles (id, display_name) values (new.id, display_name);
  insert into public.user_settings (user_id) values (new.id);
  return new;
end;
$$;
revoke all on function private.handle_new_auth_user() from public, anon, authenticated;

create function public.save_onboarding_step(p_step integer, p_value jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  profile public.profiles;
  stage public.school_stage;
  year public.school_year;
  value text;
  goal integer;
  names text[];
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into strict profile from public.profiles where id = owner_id for update;
  if profile.onboarding_completed then return; end if;
  if p_step is null or p_step < 1 or p_step > 5 or p_step > profile.onboarding_step then raise exception 'Invalid step' using errcode = '22023'; end if;
  if p_step = 1 then
    value := btrim(p_value->>'name');
    if value is null or char_length(value) not between 1 and 80 or value ~ '[[:cntrl:]]' then raise exception 'Invalid name' using errcode = '22023'; end if;
    update public.profiles set display_name = value, onboarding_step = 2 where id = owner_id;
  elsif p_step = 2 then
    stage := (p_value->>'stage')::public.school_stage;
    if stage is null then raise exception 'Invalid stage' using errcode = '22023'; end if;
    update public.profiles set school_stage = stage,
      school_year = case when school_stage = stage then school_year else null end,
      onboarding_subjects = case when school_stage = stage then onboarding_subjects else '{}' end,
      onboarding_step = 3 where id = owner_id;
  elsif p_step = 3 then
    year := (p_value->>'year')::public.school_year;
    if profile.school_stage is null or year is null then raise exception 'Invalid year' using errcode = '22023'; end if;
    update public.profiles set school_year = year,
      onboarding_subjects = case when school_year = year then onboarding_subjects else '{}' end,
      onboarding_step = 4 where id = owner_id;
  elsif p_step = 4 then
    goal := (p_value->>'minutes')::integer;
    if goal is null or goal not between 5 and 720 then raise exception 'Invalid goal' using errcode = '22023'; end if;
    update public.profiles set daily_goal_minutes = goal, onboarding_step = 5 where id = owner_id;
  else
    if jsonb_typeof(p_value->'subjects') is distinct from 'array' then raise exception 'Invalid subjects' using errcode = '22023'; end if;
    select array_agg(btrim(item)) into names from jsonb_array_elements_text(p_value->'subjects') as items(item);
    if coalesce(cardinality(names), 0) not between 1 and 20 or exists (
      select 1 from unnest(names) n where n is null or char_length(n) not between 1 and 80 or n ~ '[[:cntrl:]]'
    ) then raise exception 'Invalid subjects' using errcode = '22023'; end if;
    select array_agg(name order by position) into names from (
      select min(n) as name, min(ordinality) as position from unnest(names) with ordinality as entries(n, ordinality) group by lower(n)
    ) normalized;
    update public.profiles set onboarding_subjects = names, onboarding_step = 6 where id = owner_id;
  end if;
end;
$$;

-- Atomic and retry-safe. Locking the profile serializes concurrent completion.
create function public.complete_onboarding(p_locale public.app_locale, p_theme public.app_theme, p_accent public.accent_color)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  profile public.profiles;
  subject_name text;
  position integer := 0;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into strict profile from public.profiles where id = owner_id for update;
  if profile.onboarding_completed then return; end if;
  if profile.onboarding_step <> 6 or profile.display_name is null or profile.school_stage is null or profile.school_year is null or profile.daily_goal_minutes is null
    or cardinality(profile.onboarding_subjects) not between 1 and 20
    or p_locale is null or p_theme is null or p_accent is null then raise exception 'Incomplete onboarding' using errcode = '22023'; end if;
  insert into public.user_settings (user_id, locale, theme, accent) values (owner_id, p_locale, p_theme, p_accent)
    on conflict (user_id) do update set locale = excluded.locale, theme = excluded.theme, accent = excluded.accent;
  foreach subject_name in array profile.onboarding_subjects loop
    if subject_name is null or char_length(btrim(subject_name)) not between 1 and 80 or subject_name ~ '[[:cntrl:]]' then raise exception 'Invalid subject' using errcode = '22023'; end if;
    if not exists (select 1 from public.subjects where user_id = owner_id and lower(btrim(name)) = lower(btrim(subject_name))) then
      insert into public.subjects (user_id, name, sort_order) values (owner_id, btrim(subject_name), position);
    end if;
    position := position + 1;
  end loop;
  update public.profiles set onboarding_completed = true, onboarding_subjects = '{}' where id = owner_id;
end;
$$;
revoke all on function public.save_onboarding_step(integer, jsonb) from public, anon;
revoke all on function public.complete_onboarding(public.app_locale, public.app_theme, public.accent_color) from public, anon;
grant execute on function public.save_onboarding_step(integer, jsonb) to authenticated;
grant execute on function public.complete_onboarding(public.app_locale, public.app_theme, public.accent_color) to authenticated;
