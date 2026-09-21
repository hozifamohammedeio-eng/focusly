begin;
select plan(18);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@focusly.test', '', now(), '{}', '{}', now(), now()),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@focusly.test', '', now(), '{}', '{}', now(), now());

insert into public.subjects (id, user_id, name) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'Mathematics');
insert into public.tasks (id, user_id, subject_id, title) values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Review algebra');
insert into public.study_blocks (id, user_id, subject_id, title, starts_at, ends_at) values
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Evening study', now(), now() + interval '1 hour');
insert into public.focus_sessions (id, user_id, subject_id, task_id, started_at, ended_at, duration_seconds, completed) values
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', now() - interval '25 minutes', now(), 1500, true);

select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'profiles has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.user_settings'::regclass), 'user_settings has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.subjects'::regclass), 'subjects has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.tasks'::regclass), 'tasks has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.study_blocks'::regclass), 'study_blocks has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.focus_sessions'::regclass), 'focus_sessions has RLS enabled');

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
set local request.jwt.claim.role = 'authenticated';

select results_eq('select count(*) from public.profiles', array[1::bigint], 'owner sees one profile');
select results_eq('select count(*) from public.user_settings', array[1::bigint], 'owner sees one settings row');
select results_eq('select count(*) from public.subjects', array[1::bigint], 'owner sees owned subjects');
select results_eq('select count(*) from public.tasks', array[1::bigint], 'owner sees owned tasks');
select results_eq('select count(*) from public.study_blocks', array[1::bigint], 'owner sees owned study blocks');
select results_eq('select count(*) from public.focus_sessions', array[1::bigint], 'owner sees owned focus sessions');
select lives_ok(
  $$insert into public.subjects (user_id, name) values ('11111111-1111-4111-8111-111111111111', 'Physics')$$,
  'owner can insert an owned row'
);
select throws_ok(
  $$insert into public.subjects (user_id, name) values ('22222222-2222-4222-8222-222222222222', 'Forbidden')$$,
  '42501',
  'new row violates row-level security policy for table "subjects"',
  'owner cannot insert for another user'
);

set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';

select results_eq(
  $$select count(*) from public.subjects where user_id = '11111111-1111-4111-8111-111111111111'$$,
  array[0::bigint],
  'another user cannot read owner subjects'
);
select results_eq(
  $$update public.tasks set title = 'Changed' where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' returning 1$$,
  $$select 1 where false$$,
  'another user cannot update owner tasks'
);
select results_eq(
  $$delete from public.study_blocks where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' returning 1$$,
  $$select 1 where false$$,
  'another user cannot delete owner study blocks'
);
select results_eq(
  $$select count(*) from public.focus_sessions where user_id = '11111111-1111-4111-8111-111111111111'$$,
  array[0::bigint],
  'another user cannot read owner focus sessions'
);

select * from finish();
rollback;
