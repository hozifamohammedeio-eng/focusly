export async function testImmediateAchievements({ db, equal, rejects, asUser }) {
  const owner = "96000000-0000-4000-8000-000000000001";
  const other = "96000000-0000-4000-8000-000000000002";
  await db.exec("reset role");
  await db.query("insert into auth.users(id) values ($1),($2)", [owner, other]);
  const subject = (await db.query("insert into public.subjects(user_id,name) values ($1,'Immediate achievement subject') returning id", [owner])).rows[0].id;

  const focus = async (minutes, subjectId = null, claim = true) => {
    await db.exec("reset role");
    const id = (await db.query(`insert into public.focus_sessions(user_id,subject_id,started_at,ended_at,duration_seconds,completed,timer_state,accumulated_seconds)
      values($1,$2,now()-make_interval(mins=>$3),now(),$3*60,true,'completed',$3*60) returning id`, [owner, subjectId, minutes])).rows[0].id;
    await asUser(owner);
    return claim ? (await db.query("select public.claim_focus_progression_reward($1) value", [id])).rows[0].value : id;
  };
  const task = async (claim = true) => {
    await db.exec("reset role");
    const id = (await db.query("insert into public.tasks(user_id,title,status,completed_at) values($1,'Immediate achievement task','completed',now()) returning id", [owner])).rows[0].id;
    await asUser(owner);
    return claim ? (await db.query("select public.claim_task_progression_reward($1) value", [id])).rows[0].value : id;
  };
  const progress = async () => Object.fromEntries((await db.query(`select p.achievement_key,p.progress,p.target,u.unlocked_at
    from public.get_achievement_progress() p left join public.user_achievements u
      on u.user_id=auth.uid() and u.achievement_key=p.achievement_key`)).rows.map(row => [row.achievement_key, row]));
  const counts = async () => (await db.query(`select
    (select count(*)::integer from public.user_achievements where user_id=$1) unlocks,
    (select count(*)::integer from public.progression_reward_events where user_id=$1 and event_type='achievement_unlocked') achievement_rewards,
    (select count(*)::integer from public.progression_reward_events where user_id=$1) all_rewards,
    (select count(*)::integer from public.city_transactions where user_id=$1) city_events,
    (select count(*)::integer from public.user_challenges where user_id=$1 and completed_at is not null) challenges`, [owner])).rows[0];

  await asUser(owner);
  equal((await progress()).focus_5.progress, 0, "new owner has zero trusted focus evidence");
  for (let index = 0; index < 4; index++) await focus(1, null, false);
  equal((await progress()).focus_5.progress, 4, "focus threshold minus one is visible");
  equal((await counts()).unlocks, 0, "read at threshold minus one does not unlock");
  const fifth = await focus(1);
  equal(fifth.awarded, true, "threshold focus claim is trusted and awarded");
  equal(fifth.achievements.map(row => row.achievementKey), ["first_focus", "focus_5"], "one trusted focus claim can unlock multiple achievements");
  equal((await progress()).focus_5.unlocked_at !== null, true, "completed focus progress is unlocked immediately");
  equal((await counts()).achievement_rewards, 2, "each focus unlock has one ledger reward");
  const afterFifth = await counts();
  const fifthReplay = (await db.query("select public.claim_focus_progression_reward($1) value", [fifth.sessionId])).rows[0].value;
  equal(fifthReplay.awarded, false, "replayed Focus claim is not newly awarded");
  equal(fifthReplay.achievements, [], "replayed Focus claim has no unlock receipts");
  equal(await counts(), afterFifth, "replayed Focus claim cannot duplicate rewards, Challenges, or City events");
  await db.query("select * from public.get_achievement_progress()");
  await db.query("select * from public.get_challenge_progress()");
  equal(await counts(), afterFifth, "achievement and challenge reads cannot award or build City");
  equal((await db.query("select public.evaluate_progression_achievements() value")).rows[0].value, [], "repeated evaluator returns no achievement receipts");
  equal(await counts(), afterFifth, "repeated evaluator cannot duplicate rewards");

  const fiftyFour = await focus(54, subject);
  equal(fiftyFour.awarded, true, "additional focus evidence is accepted");
  equal((await progress()).focus_60_minutes.progress, 59, "focus minutes remain one short of threshold");
  equal((await progress()).focus_60_minutes.unlocked_at, null, "focus minutes stay locked below threshold");
  const sixtieth = await focus(1, subject);
  equal(sixtieth.achievements.some(row => row.achievementKey === "focus_60_minutes"), true, "60 minutes unlocks in the same focus claim");
  equal((await progress()).focus_60_minutes.unlocked_at !== null, true, "60 minute read is immediately complete and unlocked");

  for (let index = 0; index < 9; index++) await task(false);
  equal((await progress()).tasks_10.progress, 9, "task threshold minus one is visible");
  equal((await progress()).tasks_10.unlocked_at, null, "nine tasks do not unlock tasks ten");
  const tenth = await task();
  equal(tenth.achievements.some(row => row.achievementKey === "first_task"), true, "first Task unlocks in the trusted Task claim");
  equal(tenth.achievements.some(row => row.achievementKey === "tasks_10"), true, "tenth Task unlocks in the same trusted Task claim");
  equal((await progress()).tasks_10.unlocked_at !== null, true, "task progress is immediately complete and unlocked");
  const afterTenth = await counts();
  const tenthReplay = (await db.query("select public.claim_task_progression_reward($1) value", [tenth.taskId])).rows[0].value;
  equal(tenthReplay.awarded, false, "replayed Task claim is not newly awarded");
  equal(tenthReplay.achievements, [], "replayed Task claim has no unlock receipts");
  equal(await counts(), afterTenth, "replayed Task claim cannot duplicate rewards, Challenges, or City events");

  await focus(240, subject);
  const finalProgress = await progress();
  for (const key of ["first_focus", "focus_5", "focus_60_minutes", "focus_300_minutes", "first_task", "tasks_10", "level_2", "level_5", "first_subject_level_2"])
    equal([Number(finalProgress[key].progress) >= Number(finalProgress[key].target), finalProgress[key].unlocked_at !== null], [true, true], `${key} has complete progress and an unlock`);
  equal((await counts()).unlocks, 9, "all nine achievements unlock exactly once");
  equal((await counts()).achievement_rewards, 9, "all nine achievements have one reward receipt");
  const afterAll = await counts();
  equal((await db.query("select public.evaluate_progression_challenges() value")).rows[0].value, [], "repeated Challenge evaluation terminates without awards");
  equal((await db.query("select public.evaluate_progression_achievements() value")).rows[0].value, [], "achievement evaluation reaches a fixed point");
  equal(await counts(), afterAll, "Challenge and achievement replay cannot duplicate any event");
  await rejects("select focusly_achievement_internal.evaluate_progression_achievements()", "42501", "client cannot call the private achievement evaluator");
  await rejects("select focusly_challenge_internal.evaluate_progression_challenges()", "42501", "client cannot call the private Challenge evaluator");
  await asUser(other);
  await rejects(`select public.claim_focus_progression_reward('${sixtieth.sessionId}')`, "P0002", "another user cannot claim owner's focus evidence");
  equal((await db.query("select count(*)::integer count from public.user_achievements where user_id=$1", [owner])).rows[0].count, 0, "RLS hides another owner's unlocks");
  equal((await db.query("select * from public.get_achievement_progress()")).rows.every(row => Number(row.progress) === 0), true, "achievement read model excludes another owner's evidence");
}
