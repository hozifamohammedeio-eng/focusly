-- One-time preparation for the audited legacy remote project, BEFORE Phase 1.
-- Kept outside the fresh-install migration chain. No table or row is dropped.
create schema focusly_legacy;
revoke all on schema focusly_legacy from public, anon, authenticated;
comment on schema focusly_legacy is 'Pre-rebuild Focusly archive. Retain until rollback window closes; not used by the application.';

-- SET SCHEMA moves attached indexes/constraints and composite types, preserving
-- PostgreSQL object identities and all inbound/outbound foreign keys.
alter table public.profiles set schema focusly_legacy;
alter table public.subjects set schema focusly_legacy;
alter table public.tasks set schema focusly_legacy;

-- Hosted postgres cannot ALTER the platform-owned auth.users table. Preserve
-- the old function separately, then retire its one audited dependent trigger
-- using Supabase's documented DROP FUNCTION ... CASCADE approach.
create function focusly_legacy.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into focusly_legacy.profiles(id) values(new.id) on conflict do nothing;
  insert into public.user_preferences(user_id) values(new.id) on conflict(user_id) do nothing;
  return new;
end;
$$;
revoke all on function focusly_legacy.handle_new_user() from public, anon, authenticated;
comment on function focusly_legacy.handle_new_user() is 'Archived provisioning implementation; deliberately has no trigger. Original definition is in the pre-reconciliation backup.';
do $$
begin
  if exists (select 1 from pg_catalog.pg_depend
    where refclassid = 'pg_catalog.pg_proc'::regclass
      and refobjid = 'public.handle_new_user()'::regprocedure
      and not (classid = 'pg_catalog.pg_trigger'::regclass and objid in (
        select oid from pg_catalog.pg_trigger where tgrelid = 'auth.users'::regclass and tgname = 'on_auth_user_created')))
  then raise exception 'Unexpected legacy provisioning dependencies; aborting'; end if;
end;
$$;
drop function public.handle_new_user() cascade;
-- Existing timestamp triggers only use pg_catalog.now(). Fix their search path.
alter function public.set_updated_at() set search_path = '';
revoke all on function public.set_updated_at() from public, anon, authenticated;

revoke all on all tables in schema focusly_legacy from public, anon, authenticated;
revoke all on table public.user_preferences, public.study_sessions,
  public.planner_items, public.prayer_preferences, public.prayer_logs,
  public.push_subscriptions, public.reminders, public.ai_usage
  from public, anon, authenticated;

do $$
declare item record;
begin
  for item in
    select n.nspname, c.relname from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'r' and (n.nspname = 'focusly_legacy' or
      (n.nspname = 'public' and c.relname in ('user_preferences','study_sessions',
       'planner_items','prayer_preferences','prayer_logs','push_subscriptions','reminders','ai_usage')))
  loop
    execute format('comment on table %I.%I is %L', item.nspname, item.relname,
      'LEGACY Focusly rollback copy. Browser/API access revoked; not used by the rebuilt application. Do not drop before validation.');
  end loop;
end;
$$;
