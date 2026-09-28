export async function testChallengeReadModel({ db, equal, rejects, asUser }) {
  const owner = '95000000-0000-4000-8000-000000000001';
  const other = '95000000-0000-4000-8000-000000000002';
  const pending = '95000000-0000-4000-8000-000000000003';
  await db.exec("reset role; set time zone 'UTC'");
  for (const id of [owner,other,pending]) await db.query('insert into auth.users(id) values($1)',[id]);
  const read = async () => (await db.query('select * from public.get_challenge_progress()')).rows;
  const byKey = rows => Object.fromEntries(rows.map(row => [row.challenge_key,row]));
  const state = async () => {
    const result = {};
    for (const table of ['progression_profiles','progression_reward_events','user_challenges','user_city_buildings','city_transactions','city_auto_events'])
      result[table] = (await db.query(`select to_jsonb(t) value from public.${table} t order by to_jsonb(t)::text`)).rows;
    return result;
  };
  const focus = async (minutes, subject=null, completed=true, timer='completed') => {
    await db.exec('reset role');
    const id = (await db.query(`insert into public.focus_sessions(user_id,subject_id,started_at,ended_at,duration_seconds,completed,timer_state,planned_seconds,accumulated_seconds)
      values($1,$2,now()-make_interval(secs=>$3),case when $4 or $5='discarded' then now() else null end,$3,$4,$5,null,$3) returning id`,
      [owner,subject,minutes*60,completed,timer])).rows[0].id;
    await asUser(owner);
    return id;
  };
  const claim = async id => db.query('select public.claim_focus_progression_reward($1)',[id]);
  await db.exec('set role anon');
  await rejects('select * from public.get_challenge_progress()','42501','anonymous challenge reads denied');
  await asUser(owner);
  await db.query("select set_config('request.jwt.claim.sub','',false)");
  await rejects('select * from public.get_challenge_progress()','42501','authenticated role without identity denied');
  await asUser(owner);
  await rejects("select focusly_challenge_internal.progress('focus_minutes',now(),now(),now())",'42501','private evidence helper inaccessible');
  const emptyState = await state();
  const initial = await read();
  equal(initial.length,4,'new user gets current virtual periods');
  equal(initial.map(row=>Number(row.progress)),[0,0,0,0],'no accepted activity means zero');
  equal(await state(),emptyState,'reads do not create profiles, assignments, rewards or City state');
  await db.exec('reset role');
  const subject = (await db.query("insert into public.subjects(user_id,name) values($1,'Read model subject') returning id",[owner])).rows[0].id;
  await claim(await focus(12,subject));
  let rows = byKey(await read());
  equal(Number(rows.daily_focus_25.progress),12,'read model shows 12 / 25');
  equal(rows.daily_focus_25.target,25,'target comes from SQL catalog');
  equal(Number(rows.weekly_subjects_2.progress),1,'one owned studied subject counts');
  await focus(180,subject); // no accepted reward
  await focus(25,null,false,'discarded');
  await focus(0,null,false,'paused');
  equal(Number(byKey(await read()).daily_focus_25.progress),12,'unclaimed and invalid Focus never inflate progress');
  await db.exec('reset role');
  const task = (await db.query("insert into public.tasks(user_id,title,status,completed_at) values($1,'Read task','completed',now()) returning id",[owner])).rows[0].id;
  await asUser(owner);
  await db.query('select public.claim_task_progression_reward($1)',[task]);
  equal(Number(byKey(await read()).daily_tasks_2.progress),1,'read model shows 1 / 2 tasks');
  await claim(await focus(78,subject));
  rows = byKey(await read());
  equal(Number(rows.weekly_focus_180.progress),90,'read model shows 90 / 180 weekly minutes');
  equal([Number(rows.daily_focus_25.progress),rows.daily_focus_25.completed],[25,true],'saved completion is capped at target');
  const beforeReads = await state();
  await db.exec('begin read only');
  await read();
  await read();
  await db.exec('commit');
  equal(await state(),beforeReads,'RPC works in a read-only transaction and leaves every reward/City table unchanged');
  await asUser(other);
  equal((await read()).map(row=>Number(row.progress)),[0,0,0,0],'another user cannot see owner activity');
  equal((await read()).every(row=>!row.completed),true,'another user cannot see owner completion');
  await asUser(owner);
  equal(await state(),beforeReads,'foreign reads cannot change owner state');
  await db.query("update public.user_settings set time_zone='Pacific/Kiritimati' where user_id=$1",[owner]);
  equal(await read(),Object.values(rows),'active saved periods survive timezone changes');
  await db.exec('reset role');
  await db.query("update public.tasks set status='todo',completed_at=null where id=$1",[task]);
  await asUser(owner);
  equal(Number(byKey(await read()).daily_tasks_2.progress),0,'incomplete task no longer contributes to incomplete challenge');

  // An accepted source can meet a target before evaluation. Reading must neither
  // award nor pretend completion was saved, even when the bar is full.
  await db.exec('reset role');
  await db.query('insert into public.progression_profiles(user_id) values($1)',[pending]);
  const pendingFocus = (await db.query(`insert into public.focus_sessions(user_id,started_at,ended_at,duration_seconds,completed,timer_state,planned_seconds,accumulated_seconds)
    values($1,now()-interval '25 minutes',now(),1500,true,'completed',null,1500) returning id`,[pending])).rows[0].id;
  await db.query("insert into public.progression_reward_events(user_id,event_type,source_id,xp,coins,construction_points) values($1,'focus_completed',$2,25,5,5)",[pending,pendingFocus]);
  await asUser(pending);
  const pendingState = await state();
  equal([Number(byKey(await read()).daily_focus_25.progress),byKey(await read()).daily_focus_25.completed],[25,false],'full unawarded progress remains pending');
  equal(await state(),pendingState,'full progress reads cannot award or persist assignments');
  const predicted = byKey(await read());
  await db.query('select public.evaluate_progression_challenges()');
  const evaluated = byKey(await read());
  equal(evaluated.daily_focus_25.completed,true,'shared calculation agrees with evaluator');
  equal([evaluated.daily_focus_25.starts_at,evaluated.daily_focus_25.ends_at],[predicted.daily_focus_25.starts_at,predicted.daily_focus_25.ends_at],'virtual and persisted evaluator windows match');
  await db.exec('reset role');
  await db.query("update public.focus_sessions set duration_seconds=60,accumulated_seconds=60 where id=$1",[pendingFocus]);
  await db.query("update public.progression_reward_events set created_at=now()-interval '30 days' where user_id=$1 and event_type='focus_completed'",[pending]);
  await asUser(pending);
  equal([Number(byKey(await read()).daily_focus_25.progress),byKey(await read()).daily_focus_25.completed],[25,true],'awarded completion survives later source changes');
  equal(Number(byKey(await read()).weekly_focus_180.progress),0,'outside-period evidence excluded from live progress');
  await db.exec('reset role');
  await db.query("update public.user_challenges set starts_at=date_trunc('day',now())-interval '2 days',ends_at=date_trunc('day',now())-interval '1 day',completed_at=null,reward_event_id=null where user_id=$1 and challenge_key='daily_focus_25'",[pending]);
  await asUser(pending);
  equal(byKey(await read()).daily_focus_25.completed,false,'expired completion is not shown for new current window');
  await db.exec('reset role');
  await db.query("update public.user_challenges set starts_at=date_trunc('day',now())-interval '1 day',ends_at=now()-interval '1 second' where user_id=$1 and challenge_key='daily_focus_25'",[pending]);
  await asUser(pending);
  equal(byKey(await read()).daily_focus_25,undefined,'overlapping timezone gap is not presented as an active challenge');
}
