export async function testStudyCompanion({ db, equal, rejects, asUser }) {
  const owner = '98000000-0000-4000-8000-000000000001';
  const other = '98000000-0000-4000-8000-000000000002';
  await db.exec('reset role');
  await db.query('insert into auth.users(id) values($1),($2)', [owner, other]);
  await db.query('update public.profiles set onboarding_completed=true where id in ($1,$2)', [owner, other]);
  equal((await db.query("select relrowsecurity from pg_class where oid='public.study_companion_preferences'::regclass")).rows[0].relrowsecurity, true, 'companion preferences RLS enabled');
  equal((await db.query("select relrowsecurity from pg_class where oid='public.study_reminders'::regclass")).rows[0].relrowsecurity, true, 'study reminders RLS enabled');
  equal((await db.query("select relrowsecurity from pg_class where oid='companion_private.study_companion_plan_saves'::regclass")).rows[0].relrowsecurity, true, 'private idempotency table RLS enabled');
  equal((await db.query("select prosecdef from pg_proc where oid='public.apply_companion_day_plan(uuid,jsonb)'::regprocedure")).rows[0].prosecdef, false, 'exposed plan RPC is security invoker');
  equal((await db.query("select prosecdef from pg_proc where oid='companion_private.apply_companion_day_plan_impl(uuid,jsonb)'::regprocedure")).rows[0].prosecdef, true, 'privileged plan implementation is unexposed');
  equal((await db.query("select prosecdef from pg_proc where oid='public.claim_due_study_reminders()'::regprocedure")).rows[0].prosecdef, false, 'reminder claim remains security invoker');
  equal((await db.query("select has_schema_privilege('authenticated','companion_private','USAGE') allowed")).rows[0].allowed, true, 'authenticated gets only dedicated schema usage');
  equal((await db.query("select has_schema_privilege('authenticated','companion_private','CREATE') allowed")).rows[0].allowed, false, 'authenticated cannot create objects in dedicated schema');
  equal((await db.query("select has_schema_privilege('anon','companion_private','USAGE') allowed")).rows[0].allowed, false, 'anonymous cannot use dedicated schema');
  equal((await db.query("select has_function_privilege('anon','public.apply_companion_day_plan(uuid,jsonb)','EXECUTE') allowed")).rows[0].allowed, false, 'anonymous cannot execute the public plan wrapper');
  equal((await db.query("select has_function_privilege('authenticated','companion_private.apply_companion_day_plan_impl(uuid,jsonb)','EXECUTE') allowed")).rows[0].allowed, true, 'authenticated can invoke only the plan helper');
  equal((await db.query("select has_function_privilege('anon','companion_private.apply_companion_day_plan_impl(uuid,jsonb)','EXECUTE') allowed")).rows[0].allowed, false, 'anonymous cannot invoke the plan helper');
  equal((await db.query("select has_table_privilege('authenticated','companion_private.study_companion_plan_saves','SELECT') allowed")).rows[0].allowed, false, 'authenticated cannot read private idempotency rows');
  const task = (await db.query("insert into public.tasks(user_id,title,task_date) values($1,'Owner task',current_date) returning id", [owner])).rows[0].id;
  const foreignTask = (await db.query("insert into public.tasks(user_id,title,task_date) values($1,'Foreign task',current_date) returning id", [other])).rows[0].id;
  const foreignSubject = (await db.query("insert into public.subjects(user_id,name) values($1,'Foreign subject') returning id", [other])).rows[0].id;
  await asUser(owner);
  await db.query("insert into public.study_companion_preferences(user_id,companion_name) values($1,'سند')", [owner]);
  equal((await db.query('select companion_name,auto_greeting_enabled from public.study_companion_preferences')).rows, [{companion_name:'سند',auto_greeting_enabled:true}], 'owner sees configured Unicode companion name');
  await rejects(`insert into public.study_companion_preferences(user_id,companion_name) values('${other}','Foreign')`, '42501', 'cannot configure another user companion');
  await rejects(`insert into public.study_companion_preferences(user_id,companion_name) values('${owner}','   ')`, '23514', 'database rejects empty companion name');
  const due = (await db.query("insert into public.study_reminders(user_id,request_id,title,remind_at) values($1,$2,'Owner reminder',now()-interval '1 minute') returning id", [owner,'98000000-0000-4000-8000-000000000010'])).rows[0].id;
  const secondDue = (await db.query("insert into public.study_reminders(user_id,request_id,title,remind_at) values($1,$2,'Second reminder',now()-interval '1 minute') returning id", [owner,'98000000-0000-4000-8000-000000000014'])).rows[0].id;
  await rejects(`insert into public.study_reminders(user_id,request_id,title,remind_at) values('${other}','98000000-0000-4000-8000-000000000011','Forged',now())`, '42501', 'cannot insert foreign reminder');
  await rejects(`insert into public.study_reminders(user_id,request_id,title,remind_at,related_task_id) values('${owner}','98000000-0000-4000-8000-000000000012','Foreign link',now(),'${foreignTask}')`, '23503', 'cannot link foreign Task to reminder');
  await rejects(`insert into public.study_reminders(user_id,request_id,title,remind_at,related_subject_id) values('${owner}','98000000-0000-4000-8000-000000000013','Foreign link',now(),'${foreignSubject}')`, '23503', 'cannot link foreign Subject to reminder');
  equal(new Set((await db.query('select id from public.claim_due_study_reminders()')).rows.map(x=>x.id)),
    new Set([due, secondDue]), 'owner claims all due in-app reminders once');
  equal((await db.query('select id from public.claim_due_study_reminders()')).rows, [], 'due reminder claim is idempotent');
  await asUser(other);
  equal((await db.query('select companion_name from public.study_companion_preferences')).rows, [], 'other user cannot read companion name');
  equal((await db.query('select title from public.study_reminders')).rows, [], 'other user cannot read reminder');
  equal((await db.query('select id from public.claim_due_study_reminders()')).rows, [], 'other user cannot claim owner reminder');
  equal((await db.query(`update public.study_reminders set user_id='${other}' where id='${due}' returning id`)).rows, [],
    'other user cannot update or claim owner reminder');
  await db.exec('reset role; set role anon');
  await rejects('select * from public.study_reminders', '42501', 'anonymous cannot read reminders');
  await rejects('select * from public.study_companion_preferences', '42501', 'anonymous cannot read preferences');
  await rejects('select * from public.claim_due_study_reminders()', '42501', 'anonymous cannot claim reminders');
  await db.exec('reset role');
  const zones = ['UTC','Asia/Tokyo','America/Los_Angeles','Pacific/Honolulu'];
  const future = new Date(Date.now() + 25 * 60000);
  const stop = new Date(future.getTime() + 25 * 60000);
  const zone = zones.find(name => {
    const day = date => new Intl.DateTimeFormat('en-CA',{ timeZone:name,year:'numeric',month:'2-digit',day:'2-digit' }).format(date);
    return day(new Date()) === day(future) && day(future) === day(stop);
  });
  if (!zone) throw new Error('No safe test timezone');
  await db.query('update public.user_settings set time_zone=$1 where user_id=$2', [zone, owner]);
  const block = {taskId:task,title:'Owner task',startsAt:future.toISOString(),endsAt:stop.toISOString()};
  const request = '98000000-0000-4000-8000-000000000020';
  await asUser(owner);
  equal((await db.query('select public.apply_companion_day_plan($1,$2::jsonb) value',[request,JSON.stringify([block])])).rows[0].value,
    {sessions:1,alreadySaved:false}, 'confirmed day plan creates owner-linked Planner block');
  equal((await db.query('select public.apply_companion_day_plan($1,$2::jsonb) value',[request,JSON.stringify([block])])).rows[0].value.alreadySaved,
    true, 'day plan replay is idempotent');
  await rejects(`select public.apply_companion_day_plan('${request}','[]'::jsonb)`, '22023', 'invalid replay cannot change saved plan');
  await rejects(`select public.apply_companion_day_plan('98000000-0000-4000-8000-000000000021','${JSON.stringify([{...block,taskId:foreignTask,title:'Foreign task'}])}'::jsonb)`,
    '42501', 'owner cannot schedule foreign Task');
  await rejects(`select public.apply_companion_day_plan('98000000-0000-4000-8000-000000000022','${JSON.stringify([block])}'::jsonb)`,
    '23P01', 'existing Planner item blocks conflicting day plan');
  equal((await db.query("select count(*)::integer n from public.study_blocks where title='Owner task'")).rows[0].n, 1, 'replay and conflicts create no duplicate blocks');
  equal((await db.query('select count(*)::integer n from public.progression_reward_events where user_id=$1',[owner])).rows[0].n, 0, 'companion reads and writes do not award rewards');
  await asUser(other);
  equal((await db.query("select count(*)::integer n from public.study_blocks where title='Owner task'")).rows[0].n, 0, 'other user cannot read applied day plan');
  await db.exec('reset role; set role anon');
  await rejects(`select public.apply_companion_day_plan('${request}','[]'::jsonb)`, '42501', 'anonymous cannot apply a plan');
  await rejects(`select companion_private.apply_companion_day_plan_impl('${request}','[]'::jsonb)`, '42501', 'anonymous cannot call private plan implementation');
  await db.exec('reset role');
}
