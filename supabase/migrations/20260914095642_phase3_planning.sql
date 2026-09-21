-- Phase 3 only. Previously applied migrations and legacy objects are untouched.
alter table public.tasks add column due_on date;
alter table public.tasks add constraint tasks_one_deadline check (due_on is null or due_at is null);
create index tasks_due_on_idx on public.tasks(user_id, due_on);

alter table public.study_blocks add column repeat_weekly boolean not null default false;
alter table public.study_blocks add column time_zone text not null default 'UTC';
alter table public.study_blocks add constraint study_blocks_timezone_length check (char_length(time_zone) between 1 and 100);
create function private.valid_time_zone(value text) returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists(select 1 from pg_catalog.pg_timezone_names where name=value);
$$;
alter table public.study_blocks add constraint study_blocks_valid_timezone check (private.valid_time_zone(time_zone));

create unique index subjects_active_name_unique on public.subjects(user_id, lower(btrim(name))) where archived_at is null;

-- Lock before checking references, so a concurrent FK insert cannot slip between
-- the check and a delete. In-use subjects are archived, never cascade-deleted.
create function public.remove_subject(p_id uuid) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare owner_id uuid := auth.uid(); used boolean;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform 1 from public.subjects where id=p_id and user_id=owner_id for update;
  if not found then raise exception 'Subject unavailable' using errcode='P0002'; end if;
  used := exists(select 1 from public.tasks where subject_id=p_id and user_id=owner_id)
    or exists(select 1 from public.study_blocks where subject_id=p_id and user_id=owner_id)
    or exists(select 1 from public.focus_sessions where subject_id=p_id and user_id=owner_id);
  if used then update public.subjects set archived_at=now() where id=p_id and user_id=owner_id;
  else delete from public.subjects where id=p_id and user_id=owner_id; end if;
  return used;
end;
$$;
revoke all on function public.remove_subject(uuid) from public, anon;
grant execute on function public.remove_subject(uuid) to authenticated;
