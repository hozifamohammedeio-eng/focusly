import { readFile } from "node:fs/promises";

export async function testChallenges({ db, equal, rejects, asUser }) {
  // Fixture date_trunc uses UTC explicitly; the evaluator independently uses
  // each user's saved zone. Do not inherit the host machine's session timezone.
  await db.exec("reset role; set time zone 'UTC'");
  const a = "94000000-0000-4000-8000-000000000001";
  const b = "94000000-0000-4000-8000-000000000002";
  const c = "94000000-0000-4000-8000-000000000003";
  const taskUser = "94000000-0000-4000-8000-000000000004";
  const boundaryUser = "94000000-0000-4000-8000-000000000005";
  const replayUser = "94000000-0000-4000-8000-000000000006";
  const zoneUser = "94000000-0000-4000-8000-000000000007";
  const evaluate = async () => (await db.query("select public.evaluate_progression_challenges() value")).rows[0].value;
  const state = async () => ({
    balances:(await db.query("select total_xp,coins,construction_points from public.progression_profiles")).rows,
    challenges:(await db.query("select * from public.user_challenges order by id")).rows,
    rewards:(await db.query("select id from public.progression_reward_events order by id")).rows,
    city:(await db.query("select building_key,level from public.user_city_buildings order by building_key")).rows,
    receipts:(await db.query("select request_id,source_reward_event_id from public.city_transactions order by request_id")).rows,
  });
  const focus = async (owner,minutes,subject=null,completed=true,state="completed",end=null) => {
    await db.exec("reset role");
    const row = (await db.query(`insert into public.focus_sessions(user_id,subject_id,started_at,ended_at,duration_seconds,completed,timer_state,planned_seconds,accumulated_seconds)
      values($1,$2,coalesce($6::timestamptz,now())-make_interval(secs=>$3),case when $4 or $5='discarded' then coalesce($6::timestamptz,now()) else null end,$3,$4,$5,null,$3) returning id`,
      [owner,subject,minutes*60,completed,state,end])).rows[0];
    await asUser(owner);
    return row.id;
  };
  const claim = async id => (await db.query("select public.claim_focus_progression_reward($1) value",[id])).rows[0].value;
  const task = async owner => {
    await db.exec("reset role");
    const id = (await db.query("insert into public.tasks(user_id,title,status,completed_at) values($1,'Challenge task','completed',now()) returning id",[owner])).rows[0].id;
    await asUser(owner);
    return id;
  };
  await db.exec("reset role");
  for (const owner of [a,b,c,taskUser,boundaryUser,replayUser,zoneUser]) await db.query("insert into auth.users(id) values($1)",[owner]);
  // Compile-time catalog has no external dependencies beyond pure reward rules.
  const catalogSource = await readFile(new URL('../src/features/challenges/catalog.ts',import.meta.url),'utf8');
  const definitions = [...catalogSource.matchAll(/key: "([^"]+)", kind: "([^"]+)", metric: "([^"]+)", target: (\d+)/g)]
    .map(([,key,kind,metric,target])=>({key,kind,metric,target:Number(target),xp:kind==='daily'?50:150,coins:kind==='daily'?10:30}));
  equal((await db.query("select key,kind,metric,target,xp,coins from public.challenge_catalog order by key")).rows, definitions.sort((x,y)=>x.key.localeCompare(y.key)), "SQL/domain catalog and central reward parity");
  for (const table of ['challenge_catalog','user_challenges','progression_profiles','progression_reward_events','user_city_buildings','city_transactions','city_auto_events']) {
    equal((await db.query("select relrowsecurity from pg_class where oid=$1::regclass",[`public.${table}`])).rows[0].relrowsecurity,true,`${table} RLS remains enabled`);
    for (const role of ['anon','authenticated']) for (const operation of ['INSERT','UPDATE','DELETE','TRUNCATE'])
      equal((await db.query("select has_table_privilege($1,$2,$3) ok",[role,`public.${table}`,operation])).rows[0].ok,false,`${table} direct ${operation} denied`);
  }
  await rejects("insert into public.challenge_catalog values('bad','daily','focus_minutes',0,50,10)",'23514','zero targets rejected');
  await rejects("insert into public.challenge_catalog values('bad','daily','focus_minutes',1,-50,10)",'23514','negative rewards rejected');
  await rejects("insert into public.challenge_catalog values('bad','daily','focus_minutes',1,51,10)",'23514','conflicting rewards rejected');
  // Authoritative date helper tests independent of the machine/current date.
  for (const [kind,zone,instant,start,end] of [
    ['daily','UTC','2026-09-27T00:00:00Z','2026-09-27T00:00:00Z','2026-09-28T00:00:00Z'],
    ['weekly','UTC','2026-09-25T23:59:59Z','2026-09-19T00:00:00Z','2026-09-26T00:00:00Z'],
    ['weekly','UTC','2026-09-26T00:00:00Z','2026-09-26T00:00:00Z','2026-10-03T00:00:00Z'],
    ['daily','America/New_York','2026-03-08T12:00:00Z','2026-03-08T05:00:00Z','2026-03-09T04:00:00Z'],
    ['daily','America/New_York','2026-11-01T12:00:00Z','2026-11-01T04:00:00Z','2026-11-02T05:00:00Z'],
    ['daily','Africa/Cairo','2026-09-26T22:30:00Z','2026-09-26T21:00:00Z','2026-09-27T21:00:00Z'],
  ]) {
    const row=(await db.query("select * from focusly_challenge_internal.period($1,$2,$3)",[kind,zone,instant])).rows[0];
    equal([row.starts_at.toISOString(),row.ends_at.toISOString()],[new Date(start).toISOString(),new Date(end).toISOString()],`${kind} ${zone} midnight/DST window`);
  }
  await db.exec("set role anon");
  await rejects("select public.evaluate_progression_challenges()",'42501','anonymous evaluator denied');
  await rejects("select * from public.user_challenges",'42501','anonymous challenges denied');
  await asUser(a);
  await rejects("select * from focusly_challenge_internal.period('daily','UTC',now())",'42501','clients cannot choose period clock');
  equal(await evaluate(),[],'no activity earns nothing');
  equal((await state()).challenges.length,4,'deterministic four assignments');
  const initial=await state();
  equal(await evaluate(),[],'empty repeat earns nothing');
  equal(await state(),initial,'empty evaluation is idempotent');
  const incomplete=await focus(a,0,null,false,'paused');
  await rejects(`select public.claim_focus_progression_reward('${incomplete}')`,'P0002','incomplete Focus cannot count');
  const discarded=await focus(a,25,null,false,'discarded');
  await rejects(`select public.claim_focus_progression_reward('${discarded}')`,'P0002','discarded Focus cannot count');
  equal(await evaluate(),[],'invalid Focus never completes challenge');
  const valid=await focus(a,25);
  const earned=await claim(valid);
  equal(earned.challenges.map(x=>x.challengeKey),['daily_focus_25'],'normal Focus claim evaluates automatically without page visit');
  equal(earned.balances,{totalXp:75,coins:10,constructionPoints:0},'base Focus plus challenge minus City spending exactly once');
  const after=await state();
  equal((await claim(valid)).challenges,[],'duplicate claim cannot re-evaluate');
  equal(await evaluate(),[],'duplicate evaluator cannot re-award');
  equal(await state(),after,'duplicate reward and City state unchanged');
  await asUser(b);
  equal((await state()).challenges.length,0,'cross-user challenge reads hidden');
  equal(await evaluate(),[],'foreign study cannot count');
  await rejects(`select public.claim_focus_progression_reward('${valid}')`,'P0002','foreign claim denied');
  await asUser(a);
  equal(await state(),after,'foreign evaluations leave owner untouched');

  const t1=await task(taskUser);
  const t2=await task(taskUser);
  const taskClaim=async id=>(await db.query("select public.claim_task_progression_reward($1) value",[id])).rows[0].value;
  equal((await taskClaim(t1)).challenges,[],'unclaimed task does not count');
  const tasksEarned=await taskClaim(t2);
  equal(tasksEarned.challenges.map(x=>x.challengeKey),['daily_tasks_2'],'two genuine task claims count');
  equal(tasksEarned.balances,{totalXp:80,coins:14,constructionPoints:2},'task challenge balances exact');
  const tasksAfter=await state();
  equal((await taskClaim(t2)).challenges,[],'task replay does not award');
  equal(await state(),tasksAfter,'task replay preserves state');

  // Challenge XP crosses knowledge-center eligibility; existing construction
  // points are used by the same City authority, never invented by the challenge.
  await db.exec('reset role');
  await db.query('insert into public.progression_profiles(user_id,coins,construction_points) values($1,0,100)',[c]);
  const s1=(await db.query("insert into public.subjects(user_id,name) values($1,'One') returning id",[c])).rows[0].id;
  const s2=(await db.query("insert into public.subjects(user_id,name) values($1,'Two') returning id",[c])).rows[0].id;
  await claim(await focus(c,25,s1));
  const rich=await claim(await focus(c,1,s2));
  equal(rich.challenges.map(x=>x.challengeKey),['weekly_subjects_2'],'distinct owned study subjects complete weekly challenge');
  equal(rich.challenges[0].cityConstruction.some(x=>x.building.building_key==='knowledge_center'),true,'challenge reward triggers City without copied construction logic');
  const richAfter=await state();
  equal(await evaluate(),[],'weekly reward is idempotent');
  equal(await state(),richAfter,'challenge-triggered City does not repeat');
  const weekly=await claim(await focus(c,154,s1));
  equal(weekly.challenges.map(x=>x.challengeKey),['weekly_focus_180'],'weekly accepted focus minutes aggregate');
  equal((await db.query("select count(*)::int n from public.progression_reward_events where event_type='challenge_completed'")).rows[0].n,3,'each completed challenge has exactly one ledger event');
  equal((await db.query("select p.total_xp=(select sum(xp) from public.progression_reward_events) and p.coins=(select sum(coins) from public.progression_reward_events)-(select coalesce(sum(coins),0) from public.city_transactions) and p.construction_points=100+(select sum(construction_points) from public.progression_reward_events)-(select coalesce(sum(construction_points),0) from public.city_transactions) ok from public.progression_profiles p")).rows[0].ok,true,'final rewards and City spending reconcile');

  // Timezone is captured once per active window, even if user settings change.
  await asUser(a);
  await db.query("update public.user_settings set time_zone='Pacific/Kiritimati' where user_id=$1",[a]);
  await evaluate();
  equal((await state()).challenges,after.challenges,'timezone changes cannot replace or multiply active assignments');

  // Expired rows are never revisited. Old/future completions cannot qualify now.
  await asUser(boundaryUser);
  await evaluate();
  await db.exec('reset role');
  await db.query("insert into public.user_challenges(user_id,challenge_key,time_zone,starts_at,ends_at) values($1,'daily_focus_25','UTC',date_trunc('day',now())-interval '1 day',date_trunc('day',now()))",[boundaryUser]);
  const old=(await db.query("select date_trunc('day',now())-interval '1 second' t")).rows[0].t.toISOString();
  equal((await claim(await focus(boundaryUser,25,null,true,'completed',old))).challenges,[],'old completion claimed today cannot count');
  equal((await claim(await focus(boundaryUser,25,null,true,'completed','2099-01-01T00:00:00Z'))).challenges,[],'future completion cannot count');
  equal((await db.query("select count(*)::int n from public.user_challenges where ends_at<=now() and completed_at is not null")).rows[0].n,0,'expired challenges never newly complete');
  await db.exec('reset role');
  const midnight=(await db.query("select date_trunc('day',now()) t")).rows[0].t.toISOString();
  equal((await claim(await focus(boundaryUser,25,null,true,'completed',midnight))).challenges.map(x=>x.challengeKey),['daily_focus_25'],'exact lower boundary is inclusive');

  // A task accepted in a previous period cannot be moved into today's challenge
  // by changing its canonical completion timestamp or retrying its claim.
  const oldTask=await task(replayUser);
  await taskClaim(oldTask);
  await db.exec('reset role');
  await db.query("update public.progression_reward_events set created_at=date_trunc('day',now())-interval '1 second' where user_id=$1",[replayUser]);
  await db.query("update public.tasks set completed_at=clock_timestamp() where id=$1",[oldTask]);
  await asUser(replayUser);
  equal((await taskClaim(oldTask)).challenges,[],'recompleted old source never triggers challenges');
  equal((await taskClaim(await task(replayUser))).challenges,[],'old accepted task cannot count toward current daily target');
  equal((await taskClaim(await task(replayUser))).challenges.map(x=>x.challengeKey),['daily_tasks_2'],'two new accepted tasks still qualify');

  // Simulate a just-ended assignment that overlaps the new-zone calendar window.
  // The evaluator must leave a gap rather than creating an overlapping reward.
  await asUser(zoneUser);
  await evaluate();
  await db.exec('reset role');
  await db.query("update public.user_challenges set starts_at=date_trunc('day',now())-interval '1 day', ends_at=clock_timestamp()-interval '1 second' where user_id=$1 and challenge_key='daily_focus_25'",[zoneUser]);
  await asUser(zoneUser);
  await evaluate();
  equal((await db.query("select count(*)::int n from public.user_challenges where challenge_key='daily_focus_25'")).rows[0].n,1,'overlapping reassignment is blocked after prior window ends');
  await db.exec('reset role');
  await db.query("update public.user_challenges set ends_at=date_trunc('day',now()) where user_id=$1 and challenge_key='daily_focus_25'",[zoneUser]);
  await asUser(zoneUser);
  await evaluate();
  equal((await db.query("select count(*)::int n from public.user_challenges where challenge_key='daily_focus_25'")).rows[0].n,2,'adjacent nonoverlapping period can be assigned');

  // Failure after rewards and City spending rolls back the entire normal claim.
  const failed=await focus(b,25);
  await db.exec('reset role');
  await db.exec(`alter table public.user_challenges add constraint test_challenge_failure check(user_id<>'${b}' or completed_at is null)`);
  await asUser(b);
  const beforeFailure=await state();
  await rejects(`select public.claim_focus_progression_reward('${failed}')`,'23514','challenge failure aborts normal claim');
  equal(await state(),beforeFailure,'rollback covers base reward, challenges and City');
  await db.exec('reset role; alter table public.user_challenges drop constraint test_challenge_failure');
  await asUser(b);
  equal((await claim(failed)).challenges.length,1,'rolled-back source safely retries');
}
