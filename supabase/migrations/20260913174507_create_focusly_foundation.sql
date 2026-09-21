create schema if not exists private;

create type public.school_stage as enum ('preparatory', 'secondary');
create type public.school_year as enum ('prep_1', 'prep_2', 'prep_3', 'secondary_1', 'secondary_2', 'secondary_3');
create type public.app_locale as enum ('en', 'ar');
create type public.app_theme as enum ('light', 'dark', 'system');
create type public.accent_color as enum ('violet', 'blue', 'green', 'orange');
create type public.task_status as enum ('todo', 'in_progress', 'completed');
create type public.task_priority as enum ('low', 'medium', 'high');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 80),
  school_stage public.school_stage,
  school_year public.school_year,
  daily_goal_minutes integer check (daily_goal_minutes is null or daily_goal_minutes between 5 and 720),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_school_year_matches_stage check (
    school_stage is null or school_year is null or
    (school_stage = 'preparatory' and school_year in ('prep_1', 'prep_2', 'prep_3')) or
    (school_stage = 'secondary' and school_year in ('secondary_1', 'secondary_2', 'secondary_3'))
  )
);

create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  locale public.app_locale not null default 'en',
  theme public.app_theme not null default 'system',
  accent public.accent_color not null default 'violet',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  color text not null default '#6558d3' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order integer not null default 0 check (sort_order >= 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid,
  title text not null check (char_length(title) between 1 and 200),
  notes text,
  status public.task_status not null default 'todo',
  priority public.task_priority not null default 'medium',
  due_at timestamptz,
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes between 1 and 1440),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint tasks_subject_owner_fk foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete set null (subject_id)
);

create table public.study_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid,
  title text not null check (char_length(title) between 1 and 200),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_blocks_valid_range check (ends_at > starts_at),
  constraint study_blocks_subject_owner_fk foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete set null (subject_id)
);

create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid,
  task_id uuid,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_seconds integer not null default 0 check (duration_seconds between 0 and 86400),
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint focus_sessions_valid_range check (ended_at is null or ended_at >= started_at),
  constraint focus_sessions_subject_owner_fk foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete set null (subject_id),
  constraint focus_sessions_task_owner_fk foreign key (task_id, user_id) references public.tasks (id, user_id) on delete set null (task_id)
);

create index subjects_user_id_idx on public.subjects (user_id);
create index tasks_user_id_idx on public.tasks (user_id);
create index tasks_subject_id_idx on public.tasks (subject_id);
create index tasks_due_at_idx on public.tasks (user_id, due_at);
create index study_blocks_user_id_idx on public.study_blocks (user_id);
create index study_blocks_subject_id_idx on public.study_blocks (subject_id);
create index study_blocks_starts_at_idx on public.study_blocks (user_id, starts_at);
create index focus_sessions_user_id_idx on public.focus_sessions (user_id);
create index focus_sessions_subject_id_idx on public.focus_sessions (subject_id);
create index focus_sessions_task_id_idx on public.focus_sessions (task_id);
create index focus_sessions_started_at_idx on public.focus_sessions (user_id, started_at);

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function private.set_updated_at();
create trigger user_settings_set_updated_at before update on public.user_settings for each row execute function private.set_updated_at();
create trigger subjects_set_updated_at before update on public.subjects for each row execute function private.set_updated_at();
create trigger tasks_set_updated_at before update on public.tasks for each row execute function private.set_updated_at();
create trigger study_blocks_set_updated_at before update on public.study_blocks for each row execute function private.set_updated_at();
create trigger focus_sessions_set_updated_at before update on public.focus_sessions for each row execute function private.set_updated_at();

create function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.user_settings (user_id) values (new.id);
  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_auth_user();

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.subjects enable row level security;
alter table public.tasks enable row level security;
alter table public.study_blocks enable row level security;
alter table public.focus_sessions enable row level security;

revoke all on table public.profiles, public.user_settings, public.subjects, public.tasks, public.study_blocks, public.focus_sessions from anon, authenticated;
grant select, insert, update, delete on table public.profiles, public.user_settings, public.subjects, public.tasks, public.study_blocks, public.focus_sessions to authenticated;
grant all on table public.profiles, public.user_settings, public.subjects, public.tasks, public.study_blocks, public.focus_sessions to service_role;

create policy "profiles_select_own" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "profiles_delete_own" on public.profiles for delete to authenticated using ((select auth.uid()) = id);

create policy "user_settings_select_own" on public.user_settings for select to authenticated using ((select auth.uid()) = user_id);
create policy "user_settings_insert_own" on public.user_settings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "user_settings_update_own" on public.user_settings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "user_settings_delete_own" on public.user_settings for delete to authenticated using ((select auth.uid()) = user_id);

create policy "subjects_select_own" on public.subjects for select to authenticated using ((select auth.uid()) = user_id);
create policy "subjects_insert_own" on public.subjects for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "subjects_update_own" on public.subjects for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "subjects_delete_own" on public.subjects for delete to authenticated using ((select auth.uid()) = user_id);

create policy "tasks_select_own" on public.tasks for select to authenticated using ((select auth.uid()) = user_id);
create policy "tasks_insert_own" on public.tasks for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "tasks_update_own" on public.tasks for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "tasks_delete_own" on public.tasks for delete to authenticated using ((select auth.uid()) = user_id);

create policy "study_blocks_select_own" on public.study_blocks for select to authenticated using ((select auth.uid()) = user_id);
create policy "study_blocks_insert_own" on public.study_blocks for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "study_blocks_update_own" on public.study_blocks for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "study_blocks_delete_own" on public.study_blocks for delete to authenticated using ((select auth.uid()) = user_id);

create policy "focus_sessions_select_own" on public.focus_sessions for select to authenticated using ((select auth.uid()) = user_id);
create policy "focus_sessions_insert_own" on public.focus_sessions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "focus_sessions_update_own" on public.focus_sessions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "focus_sessions_delete_own" on public.focus_sessions for delete to authenticated using ((select auth.uid()) = user_id);
