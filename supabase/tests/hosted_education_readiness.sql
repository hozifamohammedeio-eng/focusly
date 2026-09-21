-- Hosted verification: every fixture and helper is transaction-local and rolled back.
begin;
set local statement_timeout='60s';
create temp table focusly_checks(label text);
create temp table focusly_fixture(a uuid,b uuid,subject_a uuid,task_a uuid);
insert into focusly_fixture values(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid());
create function pg_temp.check_true(ok boolean, label text) returns void language plpgsql as $$ begin
 if ok is distinct from true then raise exception 'Assertion failed: %',label; end if;
 insert into focusly_checks values(label);
end $$;
grant select on focusly_fixture to authenticated,anon;
grant select,insert on focusly_checks to authenticated,anon;
grant execute on function pg_temp.check_true(boolean,text) to authenticated,anon;
do $$ declare t text; begin
 foreach t in array array['profiles','user_settings','subjects','tasks','study_blocks','focus_sessions'] loop
   perform pg_temp.check_true((select relrowsecurity from pg_class where oid=('public.'||t)::regclass),t||' RLS enabled');
   perform pg_temp.check_true((select count(*)=4 from pg_policies where schemaname='public' and tablename=t),t||' ownership policy count');
   perform pg_temp.check_true((select bool_and(has_table_privilege('authenticated','public.'||t,privilege)) from unnest(array['SELECT','INSERT','UPDATE','DELETE']) as privileges(privilege)),t||' authenticated API grants');
   perform pg_temp.check_true(not has_table_privilege('anon','public.'||t,'SELECT'),t||' anonymous read revoked');
 end loop;
 perform pg_temp.check_true((select count(*)=4 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name in ('education_system','academic_branch','academic_track','specialization_subject') and is_nullable='YES'),'four nullable education columns');
 perform pg_temp.check_true(not has_function_privilege('anon','public.save_education(jsonb,text[])','EXECUTE'),'education RPC anonymous denied');
 perform pg_temp.check_true(not (select prosecdef from pg_proc where oid='public.save_education(jsonb,text[])'::regprocedure),'education RPC security invoker');
end $$;
insert into auth.users(id,aud,role,email,raw_user_meta_data)
 select a,'authenticated','authenticated',a::text||'@focusly.invalid','{"display_name":"Transaction-only A"}'::jsonb from focusly_fixture
 union all select b,'authenticated','authenticated',b::text||'@focusly.invalid','{"display_name":"Transaction-only B"}'::jsonb from focusly_fixture;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select a::text from focusly_fixture),true);
do $$ declare e jsonb; p public.profiles; yr text; chosen_accent public.accent_color; begin
 perform pg_temp.check_true((select count(*)=1 from public.profiles),'provisioning creates private own profile');
 perform pg_temp.check_true((select count(*)=1 from public.user_settings),'provisioning creates private own settings');
 for yr in select unnest(array['secondary_1','secondary_2','secondary_3']) loop
   update public.profiles set onboarding_completed=false,onboarding_step=1 where id=auth.uid();
   perform public.save_onboarding_step(1,'{"name":"Transaction-only A"}');
   perform public.save_onboarding_step(2,'{"stage":"secondary"}');
   perform public.save_onboarding_step(3,jsonb_build_object('year',yr));
   perform public.save_onboarding_step(4,'{"minutes":120}');
   perform public.save_onboarding_step(5,'{"subjects":["Transaction-only custom subject"]}');
   perform public.complete_onboarding('ar','dark','green');
   perform pg_temp.check_true((select onboarding_completed and education_system is null from public.profiles where id=auth.uid()),'legacy onboarding '||yr);
 end loop;
 for e in select value from jsonb_array_elements('[{"school_stage":"preparatory","school_year":"prep_1","education_system":null,"academic_branch":null,"academic_track":null,"specialization_subject":null},{"school_stage":"preparatory","school_year":"prep_2","education_system":null,"academic_branch":null,"academic_track":null,"specialization_subject":null},{"school_stage":"preparatory","school_year":"prep_3","education_system":null,"academic_branch":null,"academic_track":null,"specialization_subject":null},{"school_stage":"secondary","school_year":"secondary_1","education_system":"general_secondary","academic_branch":null,"academic_track":null,"specialization_subject":null},{"school_stage":"secondary","school_year":"secondary_1","education_system":"egyptian_baccalaureate","academic_branch":null,"academic_track":null,"specialization_subject":null},{"school_stage":"secondary","school_year":"secondary_2","education_system":"general_secondary","academic_branch":"scientific","academic_track":null,"specialization_subject":null},{"school_stage":"secondary","school_year":"secondary_2","education_system":"general_secondary","academic_branch":"literary","academic_track":null,"specialization_subject":null},{"school_stage":"secondary","school_year":"secondary_2","education_system":"egyptian_baccalaureate","academic_branch":null,"academic_track":"medicine_life_sciences","specialization_subject":"physics"},{"school_stage":"secondary","school_year":"secondary_2","education_system":"egyptian_baccalaureate","academic_branch":null,"academic_track":"medicine_life_sciences","specialization_subject":"mathematics"},{"school_stage":"secondary","school_year":"secondary_2","education_system":"egyptian_baccalaureate","academic_branch":null,"academic_track":"engineering_computer_science","specialization_subject":"chemistry"},{"school_stage":"secondary","school_year":"secondary_2","education_system":"egyptian_baccalaureate","academic_branch":null,"academic_track":"engineering_computer_science","specialization_subject":"programming_ai"},{"school_stage":"secondary","school_year":"secondary_2","education_system":"egyptian_baccalaureate","academic_branch":null,"academic_track":"business","specialization_subject":"accounting"},{"school_stage":"secondary","school_year":"secondary_2","education_system":"egyptian_baccalaureate","academic_branch":null,"academic_track":"business","specialization_subject":"business_administration"},{"school_stage":"secondary","school_year":"secondary_2","education_system":"egyptian_baccalaureate","academic_branch":null,"academic_track":"arts_humanities","specialization_subject":"psychology"},{"school_stage":"secondary","school_year":"secondary_2","education_system":"egyptian_baccalaureate","academic_branch":null,"academic_track":"arts_humanities","specialization_subject":"second_language"},{"school_stage":"secondary","school_year":"secondary_3","education_system":"general_secondary","academic_branch":"science","academic_track":null,"specialization_subject":null},{"school_stage":"secondary","school_year":"secondary_3","education_system":"general_secondary","academic_branch":"mathematics","academic_track":null,"specialization_subject":null},{"school_stage":"secondary","school_year":"secondary_3","education_system":"general_secondary","academic_branch":"literary","academic_track":null,"specialization_subject":null},{"school_stage":"secondary","school_year":"secondary_3","education_system":"egyptian_baccalaureate","academic_branch":null,"academic_track":"medicine_life_sciences","specialization_subject":null},{"school_stage":"secondary","school_year":"secondary_3","education_system":"egyptian_baccalaureate","academic_branch":null,"academic_track":"engineering_computer_science","specialization_subject":null},{"school_stage":"secondary","school_year":"secondary_3","education_system":"egyptian_baccalaureate","academic_branch":null,"academic_track":"business","specialization_subject":null},{"school_stage":"secondary","school_year":"secondary_3","education_system":"egyptian_baccalaureate","academic_branch":null,"academic_track":"arts_humanities","specialization_subject":null}]'::jsonb) loop
   update public.profiles set onboarding_completed=false,onboarding_step=1 where id=auth.uid();
   perform public.save_onboarding_step(1,'{"name":"Transaction-only A"}');
   perform public.save_onboarding_step(2,jsonb_build_object('stage',e->>'school_stage'));
   perform public.save_onboarding_step(3,e||jsonb_build_object('year',e->>'school_year'));
   perform public.save_onboarding_step(4,'{"minutes":120}');
   perform public.save_onboarding_step(5,'{"subjects":["Transaction-only custom subject"]}');
   perform public.complete_onboarding('ar','dark','green');
   select * into p from public.profiles where id=auth.uid();
   perform pg_temp.check_true(p.onboarding_completed and to_jsonb(p) @> e,'new onboarding '||e::text);
   perform public.save_education(e||'{"display_name":"Transaction-only A","daily_goal_minutes":90}'::jsonb,array['Transaction-only custom subject']);
   select * into p from public.profiles where id=auth.uid();
   perform pg_temp.check_true(to_jsonb(p) @> e,'profile persistence '||e::text);
 end loop;
 perform pg_temp.check_true((select count(*)=1 from public.subjects where user_id=auth.uid() and name='Transaction-only custom subject'),'custom subject preserved and deduplicated');
 begin
   perform public.save_education('{"school_stage":"secondary","school_year":"secondary_2","education_system":"egyptian_baccalaureate","academic_track":"engineering_computer_science","specialization_subject":"physics","display_name":"Invalid","daily_goal_minutes":120}');
   raise exception 'Invalid elective accepted';
 exception when sqlstate '22023' then perform pg_temp.check_true(true,'invalid engineering elective denied'); end;
 foreach chosen_accent in array array['violet','blue','green','orange']::public.accent_color[] loop
   update public.user_settings set accent=chosen_accent where user_id=auth.uid();
   perform pg_temp.check_true((select locale='ar' and accent=chosen_accent from public.user_settings where user_id=auth.uid()),'appearance patch persists accent and retains locale');
 end loop;
end $$;
insert into public.subjects(id,user_id,name) select subject_a,a,'Transaction-only ownership' from focusly_fixture;
insert into public.tasks(id,user_id,subject_id,title) select task_a,a,subject_a,'Transaction-only task' from focusly_fixture;
insert into public.study_blocks(user_id,subject_id,title,starts_at,ends_at) select a,subject_a,'Transaction-only block',now(),now()+interval '1 hour' from focusly_fixture;
insert into public.focus_sessions(user_id,subject_id,task_id,started_at) select a,subject_a,task_a,now() from focusly_fixture;
select set_config('request.jwt.claim.sub',(select b::text from focusly_fixture),true);
do $$ declare t text; owner_column text; n integer; fixture_a uuid; subject_a uuid; task_a uuid; begin
 select a,f.subject_a,f.task_a into fixture_a,subject_a,task_a from focusly_fixture f;
 foreach t in array array['profiles','user_settings','subjects','tasks','study_blocks','focus_sessions'] loop
   owner_column:=case when t='profiles' then 'id' else 'user_id' end;
   execute format('select count(*) from public.%I where %I=$1',t,owner_column) into n using fixture_a;
   perform pg_temp.check_true(n=0,t||' cross-user read blocked');
   execute format('update public.%I set updated_at=updated_at where %I=$1',t,owner_column) using fixture_a;
   get diagnostics n=row_count;
   perform pg_temp.check_true(n=0,t||' cross-user update blocked');
 end loop;
 begin insert into public.subjects(user_id,name) values(fixture_a,'Forbidden'); raise exception 'Forged owner allowed';
 exception when insufficient_privilege then perform pg_temp.check_true(true,'forged owner insert denied'); end;
 begin insert into public.tasks(user_id,subject_id,title) values(auth.uid(),subject_a,'Forbidden'); raise exception 'Foreign subject allowed';
 exception when foreign_key_violation then perform pg_temp.check_true(true,'foreign task subject denied'); end;
 begin insert into public.study_blocks(user_id,subject_id,title,starts_at,ends_at) values(auth.uid(),subject_a,'Forbidden',now(),now()+interval '1 hour'); raise exception 'Foreign block subject allowed';
 exception when foreign_key_violation then perform pg_temp.check_true(true,'foreign block subject denied'); end;
 begin insert into public.focus_sessions(user_id,subject_id,started_at) values(auth.uid(),subject_a,now()); raise exception 'Foreign focus subject allowed';
 exception when foreign_key_violation then perform pg_temp.check_true(true,'foreign focus subject denied'); end;
 begin insert into public.focus_sessions(user_id,task_id,started_at) values(auth.uid(),task_a,now()); raise exception 'Foreign task allowed';
 exception when foreign_key_violation then perform pg_temp.check_true(true,'foreign focus task denied'); end;
end $$;
set local role anon;
do $$ declare t text; begin
 foreach t in array array['profiles','user_settings','subjects','tasks','study_blocks','focus_sessions'] loop
   begin execute format('select 1 from public.%I limit 1',t); raise exception 'Anonymous access allowed: %',t;
   exception when insufficient_privilege then perform pg_temp.check_true(true,t||' anonymous query blocked'); end;
 end loop;
 begin perform public.save_education('{}'); raise exception 'Anonymous RPC allowed';
 exception when insufficient_privilege then perform pg_temp.check_true(true,'anonymous RPC call blocked'); end;
end $$;
reset role;
select count(*)::integer as passed_assertions,'PASS; all fixtures rolled back' as result from focusly_checks;
rollback;
