-- One stable calendar day per task. Existing scheduling fields and reward rows stay intact.
alter table public.tasks add column task_date date;

-- The existing generic update trigger would rewrite historical updated_at
-- during the one-time backfill. DDL takes a table lock; restore the trigger
-- before releasing it so normal application writes keep their timestamps.
alter table public.tasks disable trigger tasks_set_updated_at;

-- A date-only deadline is authoritative. Timed deadlines and otherwise undated
-- legacy rows use the user's saved zone at migration time (UTC when unset).
-- That one-time fallback is frozen; later zone changes do not rewrite history.
update public.tasks t
set task_date = coalesce(
  t.due_on,
  (t.due_at at time zone coalesce(s.time_zone, 'UTC'))::date,
  (t.created_at at time zone coalesce(s.time_zone, 'UTC'))::date
)
from public.user_settings s
where s.user_id = t.user_id;

-- Provisioning normally guarantees settings, but preserve any orphaned legacy
-- task without relying on that assumption.
update public.tasks
set task_date = coalesce(due_on, due_at::date, created_at::date)
where task_date is null;

alter table public.tasks enable trigger tasks_set_updated_at;

alter table public.tasks alter column task_date set not null;
create index tasks_user_task_date_idx on public.tasks (user_id, task_date);

-- Keep the currently deployed app compatible during rollout: old writes omit
-- task_date. New writes can set it explicitly; changing a deadline in an old
-- client updates the day, while completion and unrelated edits leave it stable.
create function private.set_task_date() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare zone text;
begin
  if tg_op = 'UPDATE' then
    if new.task_date is distinct from old.task_date then return new; end if;
    if new.due_on is not distinct from old.due_on
       and new.due_at is not distinct from old.due_at then return new; end if;
  elsif new.task_date is not null then
    return new;
  end if;
  select coalesce(time_zone, 'UTC') into zone
    from public.user_settings where user_id = new.user_id;
  zone := coalesce(zone, 'UTC');
  new.task_date := coalesce(new.due_on,
    (new.due_at at time zone zone)::date,
    (new.created_at at time zone zone)::date);
  return new;
end;
$$;
revoke all on function private.set_task_date() from public, anon, authenticated;
create trigger tasks_set_task_date before insert or update on public.tasks
for each row execute function private.set_task_date();
