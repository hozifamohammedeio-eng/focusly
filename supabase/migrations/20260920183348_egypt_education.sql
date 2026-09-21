-- Additive education data: legacy rows retain NULL fields and historical subjects.
-- Generated allowed combinations from src/features/education/config.ts.
-- Deployment compatibility: legacy clients send only {year} at step 3.
-- Missing education fields remain NULL, never guessed. New payloads/RPCs stay strict.
alter table public.profiles
  add column education_system text,
  add column academic_branch text,
  add column academic_track text,
  add column specialization_subject text;

create function public.valid_education(p_stage text, p_year text, p_system text, p_branch text, p_track text, p_specialization text)
returns boolean language sql immutable security invoker set search_path = '' as $$
 select exists (select 1 from (values
  ('preparatory', 'prep_1', null, null, null, null),
  ('preparatory', 'prep_2', null, null, null, null),
  ('preparatory', 'prep_3', null, null, null, null),
  ('secondary', 'secondary_1', 'general_secondary', null, null, null),
  ('secondary', 'secondary_1', 'egyptian_baccalaureate', null, null, null),
  ('secondary', 'secondary_2', 'general_secondary', 'scientific', null, null),
  ('secondary', 'secondary_2', 'general_secondary', 'literary', null, null),
  ('secondary', 'secondary_2', 'egyptian_baccalaureate', null, 'medicine_life_sciences', 'physics'),
  ('secondary', 'secondary_2', 'egyptian_baccalaureate', null, 'medicine_life_sciences', 'mathematics'),
  ('secondary', 'secondary_2', 'egyptian_baccalaureate', null, 'engineering_computer_science', 'chemistry'),
  ('secondary', 'secondary_2', 'egyptian_baccalaureate', null, 'engineering_computer_science', 'programming_ai'),
  ('secondary', 'secondary_2', 'egyptian_baccalaureate', null, 'business', 'accounting'),
  ('secondary', 'secondary_2', 'egyptian_baccalaureate', null, 'business', 'business_administration'),
  ('secondary', 'secondary_2', 'egyptian_baccalaureate', null, 'arts_humanities', 'psychology'),
  ('secondary', 'secondary_2', 'egyptian_baccalaureate', null, 'arts_humanities', 'second_language'),
  ('secondary', 'secondary_3', 'general_secondary', 'science', null, null),
  ('secondary', 'secondary_3', 'general_secondary', 'mathematics', null, null),
  ('secondary', 'secondary_3', 'general_secondary', 'literary', null, null),
  ('secondary', 'secondary_3', 'egyptian_baccalaureate', null, 'medicine_life_sciences', null),
  ('secondary', 'secondary_3', 'egyptian_baccalaureate', null, 'engineering_computer_science', null),
  ('secondary', 'secondary_3', 'egyptian_baccalaureate', null, 'business', null),
  ('secondary', 'secondary_3', 'egyptian_baccalaureate', null, 'arts_humanities', null)
 ) as allowed(stage, year, system, branch, track, specialization)
 where stage = p_stage and year = p_year and system is not distinct from p_system
 and branch is not distinct from p_branch and track is not distinct from p_track
 and specialization is not distinct from p_specialization);
$$;
revoke all on function public.valid_education(text,text,text,text,text,text) from public, anon;
grant execute on function public.valid_education(text,text,text,text,text,text) to authenticated, service_role;
alter table public.profiles add constraint profiles_education_combination check (
 (education_system is null and academic_branch is null and academic_track is null and specialization_subject is null)
 or public.valid_education(school_stage::text,school_year::text,education_system,academic_branch,academic_track,specialization_subject)
);

-- One invoker trigger handles stale dependent fields for direct API writes too.
create function private.normalize_education() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
 if new.school_year is distinct from old.school_year
   and new.education_system is not distinct from old.education_system
   and new.academic_branch is not distinct from old.academic_branch
   and new.academic_track is not distinct from old.academic_track
   and new.specialization_subject is not distinct from old.specialization_subject
   and not public.valid_education(new.school_stage::text,new.school_year::text,new.education_system,new.academic_branch,new.academic_track,new.specialization_subject) then
   -- Old Profile/Settings edits do not send dependent education fields.
   new.education_system := null; new.academic_branch := null; new.academic_track := null; new.specialization_subject := null;
 end if;
 if new.school_stage is distinct from old.school_stage then
   new.education_system := null; new.academic_branch := null; new.academic_track := null; new.specialization_subject := null;
 end if;
 if new.school_year = 'secondary_1' or new.school_stage = 'preparatory' then
   new.academic_branch := null; new.academic_track := null; new.specialization_subject := null;
 end if;
 if new.school_stage = 'preparatory' then new.education_system := null; end if;
 if new.education_system = 'general_secondary' then new.academic_track := null; new.specialization_subject := null; end if;
 if new.education_system = 'egyptian_baccalaureate' then new.academic_branch := null; end if;
 if new.school_year = 'secondary_3' then new.specialization_subject := null; end if;
 if new.onboarding_completed and not old.onboarding_completed and new.education_system is not null and not public.valid_education(new.school_stage::text,new.school_year::text,new.education_system,new.academic_branch,new.academic_track,new.specialization_subject) then
   raise exception 'Incomplete education' using errcode='22023';
 end if;
 return new;
end;
$$;
revoke all on function private.normalize_education() from public, anon, authenticated;
create trigger profiles_normalize_education before update on public.profiles for each row execute function private.normalize_education();

create function public.save_education(p_value jsonb, p_subjects text[] default '{}')
returns void language plpgsql security invoker set search_path = '' as $$
declare owner_id uuid := auth.uid(); subject_name text; profile public.profiles;
begin
 if owner_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select * into strict profile from public.profiles where id=owner_id for update;
 if not public.valid_education(p_value->>'school_stage', p_value->>'school_year', p_value->>'education_system', p_value->>'academic_branch', p_value->>'academic_track', p_value->>'specialization_subject') then raise exception 'Invalid education' using errcode='22023'; end if;
 if nullif(btrim(p_value->>'display_name'),'') is null or char_length(p_value->>'display_name') > 80 or (p_value->>'display_name') ~ '[[:cntrl:]]' or (p_value->>'daily_goal_minutes') is null or (p_value->>'daily_goal_minutes')::integer not between 5 and 720 then raise exception 'Invalid profile' using errcode='22023'; end if;
 -- Set stage first so the normalization trigger clears old dependent answers.
 update public.profiles set school_stage=(p_value->>'school_stage')::public.school_stage, school_year=null, education_system=null,academic_branch=null,academic_track=null,specialization_subject=null where id=owner_id;
 update public.profiles set display_name=btrim(p_value->>'display_name'), daily_goal_minutes=(p_value->>'daily_goal_minutes')::integer,
 school_year=(p_value->>'school_year')::public.school_year, education_system=p_value->>'education_system',academic_branch=p_value->>'academic_branch',academic_track=p_value->>'academic_track',specialization_subject=p_value->>'specialization_subject' where id=owner_id;
 if p_subjects is null or cardinality(p_subjects)>20 then raise exception 'Invalid subjects' using errcode='22023'; end if;
 foreach subject_name in array p_subjects loop
   if subject_name is null or char_length(btrim(subject_name)) not between 1 and 80 or subject_name ~ '[[:cntrl:]]' then raise exception 'Invalid subject' using errcode='22023'; end if;
   if not exists(select 1 from public.subjects where user_id=owner_id and lower(btrim(name))=lower(btrim(subject_name)) and archived_at is null) then
     insert into public.subjects(user_id,name,sort_order) values(owner_id,btrim(subject_name),(select coalesce(max(sort_order),-1)+1 from public.subjects where user_id=owner_id));
   end if;
 end loop;
end;
$$;
revoke all on function public.save_education(jsonb,text[]) from public, anon;
grant execute on function public.save_education(jsonb,text[]) to authenticated;

create or replace function public.save_onboarding_step(p_step integer, p_value jsonb)
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
    if (p_value ?| array['education_system','academic_branch','academic_track','specialization_subject']) and not public.valid_education(profile.school_stage::text, year::text, p_value->>'education_system',p_value->>'academic_branch',p_value->>'academic_track',p_value->>'specialization_subject') then raise exception 'Invalid education' using errcode='23514'; end if;
    update public.profiles set education_system=p_value->>'education_system',academic_branch=p_value->>'academic_branch',academic_track=p_value->>'academic_track',specialization_subject=p_value->>'specialization_subject', school_year = year,
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
create or replace function public.complete_onboarding(p_locale public.app_locale, p_theme public.app_theme, p_accent public.accent_color)
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
  if profile.education_system is not null and not public.valid_education(profile.school_stage::text,profile.school_year::text,profile.education_system,profile.academic_branch,profile.academic_track,profile.specialization_subject) then raise exception 'Incomplete education' using errcode='22023'; end if;
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
