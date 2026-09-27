// Uses only the existing ephemeral database, with privileged fixture setup.
export async function testAutomaticCity({ db, equal, rejects, asUser }) {
  const focusOwner = "93000000-0000-4000-8000-000000000001";
  const taskOwner = "93000000-0000-4000-8000-000000000002";
  const richOwner = "93000000-0000-4000-8000-000000000003";
  const failureOwner = "93000000-0000-4000-8000-000000000004";
  const poorOwner = "93000000-0000-4000-8000-000000000005";
  await db.exec("reset role");
  for (const id of [focusOwner, taskOwner, richOwner, failureOwner, poorOwner])
    await db.query("insert into auth.users(id) values ($1)", [id]);
  const focus = async (owner, minutes, subject = null, completed = true, state = "completed") => {
    await db.exec("reset role");
    const row = (await db.query(`insert into public.focus_sessions(user_id,subject_id,started_at,ended_at,duration_seconds,completed,timer_state,planned_seconds,accumulated_seconds)
      values ($1,$2,now()-make_interval(secs=>$3),case when $4 or $5='discarded' then now() else null end,$3,$4,$5,null,$3) returning id`,
    [owner, subject, minutes * 60, completed, state])).rows[0];
    await asUser(owner);
    return row.id;
  };
  const claimFocus = async id => (await db.query("select public.claim_focus_progression_reward($1) value", [id])).rows[0].value;
  const claimTask = async id => (await db.query("select public.claim_task_progression_reward($1) value", [id])).rows[0].value;
  const snapshot = async () => ({
    buildings: (await db.query("select building_key,level from public.user_city_buildings order by building_key")).rows,
    balances: (await db.query("select total_xp,coins,construction_points from public.progression_profiles")).rows,
    receipts: (await db.query("select request_id,source_reward_event_id from public.city_transactions order by request_id")).rows,
    processed: (await db.query("select reward_event_id from public.city_auto_events order by reward_event_id")).rows,
  });
  const tasks = async (owner, count) => {
    await db.exec("reset role");
    const rows = (await db.query("insert into public.tasks(user_id,title,status,completed_at) select $1,'Automatic task '||i,'completed',now() from generate_series(1,$2::int) i returning id", [owner,count])).rows;
    await asUser(owner);
    return rows;
  };

  equal((await db.query("select relrowsecurity from pg_class where oid='public.city_auto_events'::regclass")).rows[0].relrowsecurity, true, "auto event history RLS enabled");
  for (const role of ["anon", "authenticated"]) {
    for (const operation of ["INSERT","UPDATE","DELETE","TRUNCATE"])
      equal((await db.query("select has_table_privilege($1,'public.city_auto_events',$2) allowed",[role,operation])).rows[0].allowed, false, "auto event history is client immutable");
    equal((await db.query("select has_schema_privilege($1,'focusly_city_internal','USAGE') allowed",[role])).rows[0].allowed, false, "internal schema is inaccessible");
    for (const routine of ["process_reward", "claim_focus_progression_reward", "claim_task_progression_reward"])
      equal((await db.query("select has_function_privilege($1,$2,'EXECUTE') allowed",[role,`focusly_city_internal.${routine}(uuid)`])).rows[0].allowed, false, "internal routines not callable directly");
  }
  await db.exec("set role anon");
  await rejects("select * from public.city_auto_events", "42501", "anonymous auto history denied");
  await rejects("select public.claim_focus_progression_reward(gen_random_uuid())", "42501", "anonymous focus denied");
  await rejects("select public.claim_task_progression_reward(gen_random_uuid())", "42501", "anonymous task denied");

  const incomplete = await focus(focusOwner, 0, null, false, "paused");
  await rejects(`select public.claim_focus_progression_reward('${incomplete}')`, "P0002", "incomplete Focus never advances City");
  const discarded = await focus(focusOwner, 25, null, false, "discarded");
  await rejects(`select public.claim_focus_progression_reward('${discarded}')`, "P0002", "discarded Focus never advances City");
  equal((await snapshot()).processed.length, 0, "invalid activity creates no auto event");
  equal((await snapshot()).buildings.length, 0, "starting or discarding Focus creates no building");
  const valid = await focus(focusOwner, 25);
  const earned = await claimFocus(valid);
  equal(earned.reward, { xp:25, coins:5, constructionPoints:5 }, "automatic flow preserves reward economics");
  equal(earned.cityConstruction.map(item => [item.building.building_key,item.building.level]), [["focus_tower",1]], "completed Focus builds without City visit/call");
  equal(earned.balances, { totalXp:25, coins:0, constructionPoints:0 }, "RPC returns exact post-spend balances");
  equal((await snapshot()).receipts[0].source_reward_event_id, earned.eventId, "receipt records trusted source reward");
  const afterFocus = await snapshot();
  equal((await claimFocus(valid)).cityConstruction, [], "duplicate Focus does not run construction");
  equal(await snapshot(), afterFocus, "duplicate Focus leaves all state intact");
  await asUser(taskOwner);
  equal((await snapshot()).buildings.length, 0, "user A activity cannot build for user B");
  equal((await snapshot()).processed.length, 0, "user A processing history hidden from B");
  await rejects(`select public.claim_focus_progression_reward('${valid}')`, "P0002", "foreign Focus claim denied");
  await rejects(`select focusly_city_internal.process_reward('${earned.eventId}')`, "42501", "cannot request another user's auto event");
  const taskRows = await tasks(taskOwner,5);
  const taskResults = [];
  for (const row of taskRows) taskResults.push(await claimTask(row.id));
  equal(taskResults.flatMap(item => item.cityConstruction).map(item => item.building.building_key), ["planner_hall"], "genuine tasks automatically build relevant landmark");
  equal(taskResults[4].balances, { totalXp:75, coins:5, constructionPoints:3 }, "task rewards minus one build reconcile");
  const afterTasks = await snapshot();
  equal((await claimTask(taskRows[4].id)).cityConstruction, [], "duplicate Task cannot build twice");
  equal(await snapshot(), afterTasks, "duplicate Task preserves balances and City");
  await asUser(focusOwner);
  await rejects(`select public.claim_task_progression_reward('${taskRows[0].id}')`, "P0002", "foreign task claim denied");
  equal(await snapshot(), afterFocus, "other user's tasks never change first user's City");

  // All are eligible after canonical activity, but the first new reward cannot afford a build.
  await focus(poorOwner,25); // completed but not yet claimed
  const tiny = await focus(poorOwner,1);
  const poorResult = await claimFocus(tiny);
  equal(poorResult.cityConstruction, [], "insufficient currencies prevent automatic construction");
  equal(poorResult.balances, { totalXp:1, coins:0, constructionPoints:0 }, "unaffordable pass preserves earned balances");
  equal((await snapshot()).processed.length, 1, "empty processing pass is recorded durably");
  await db.exec("reset role");
  await db.query("update public.progression_profiles set coins=100,construction_points=100 where user_id=$1",[poorOwner]);
  await asUser(poorOwner);
  const fundedSnapshot = await snapshot();
  await claimFocus(tiny);
  equal(await snapshot(), fundedSnapshot, "old event never spends funds added later");
  const next = await focus(poorOwner,1);
  const nextResult = await claimFocus(next);
  equal(nextResult.cityConstruction.map(item => item.building.building_key), ["focus_tower"], "new activity reconsiders previously unaffordable construction");
  equal((await snapshot()).buildings, [{building_key:"focus_tower",level:1}], "rich balance does not bypass study requirements");

  await db.exec("reset role");
  await db.query("insert into public.progression_profiles(user_id,coins,construction_points) values ($1,1000,1000)",[richOwner]);
  const subject = (await db.query("insert into public.subjects(user_id,name) values ($1,'Generic mastery') returning id",[richOwner])).rows[0].id;
  await tasks(richOwner,15);
  const richSession = await focus(richOwner,900,subject);
  const richResult = await claimFocus(richSession);
  const priority = ["knowledge_center","focus_tower","library_district","science_lab","language_academy","planner_hall"];
  equal(richResult.cityConstruction.map(item => [item.building.building_key,item.building.level]), [1,2,3].flatMap(level => priority.map(key => [key,level])), "automatic construction follows level-first central priority");
  equal(richResult.balances, { totalXp:900,coins:820,constructionPoints:958 }, "all levels charge exactly catalog costs times target level");
  equal((await snapshot()).buildings.every(item => item.level===3), true, "every building reaches max level three");
  const richBefore = await snapshot();
  await claimFocus(richSession);
  equal(await snapshot(), richBefore, "replaying large event cannot repeat any upgrade");
  const extra = await focus(richOwner,25,subject);
  equal((await claimFocus(extra)).cityConstruction, [], "new rewards cannot exceed maxLevel");
  equal((await snapshot()).receipts.length,18,"bounded construction count at max levels");

  // Force a failure after both reward and construction were applied.
  const failedSession = await focus(failureOwner,25);
  await db.exec("reset role");
  await db.exec(`alter table public.city_auto_events add constraint test_auto_failure check (user_id <> '${failureOwner}')`);
  await asUser(failureOwner);
  const beforeFailure = await snapshot();
  await rejects(`select public.claim_focus_progression_reward('${failedSession}')`,"23514","auto recording failure propagates to reward claim");
  equal(await snapshot(),beforeFailure,"failed auto pass rolls back reward profile, balances, buildings and spending");
  equal((await db.query("select * from public.progression_reward_events")).rows.length,0,"failed pass leaves no reward event");
  await db.exec("reset role; alter table public.city_auto_events drop constraint test_auto_failure");
  await asUser(failureOwner);
  equal((await claimFocus(failedSession)).cityConstruction.length,1,"same activity can retry after rolled-back failure");
}
