// Executes the real migrations in embedded PostgreSQL. auth.users/auth.uid are
// a minimal platform harness; this is NOT a live Supabase Auth integration test.
// Usage: node tests/database.mjs <path-to-pglite/dist/index.js>
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { testCity } from "./city-database.mjs";
import { testAutomaticCity } from "./city-auto-database.mjs";

const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
let checks = 0;
const equal = (actual, expected, label) => {
  assert.deepEqual(actual, expected, label);
  checks++;
};
async function rejects(sql, code, label) {
  await assert.rejects(db.query(sql), (error) => error.code === code, label);
  checks++;
}
const first = "11111111-1111-4111-8111-111111111111";
const second = "22222222-2222-4222-8222-222222222222";
async function asUser(id) {
  await db.exec("reset role; set role authenticated;");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
}
async function step(number, value) {
  await db.query("select public.save_onboarding_step($1, $2::jsonb)", [
    number,
    JSON.stringify(value),
  ]);
}
async function profile() {
  return (await db.query("select * from public.profiles")).rows[0];
}
async function complete() {
  await db.query("select public.complete_onboarding('ar', 'dark', 'green')");
}

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb not null default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
  `);
  for (const migration of (await readdir(new URL('../supabase/migrations/', import.meta.url))).filter(name => name.endsWith('.sql')).sort()) {
    if (migration.endsWith('_egypt_education.sql')) {
      await db.exec("insert into auth.users(id) values ('33333333-3333-4333-8333-333333333333'); update public.profiles set school_stage='secondary',school_year='secondary_3',onboarding_completed=true where id='33333333-3333-4333-8333-333333333333';");
    }
    await db.exec(
      await readFile(
        new URL(`../supabase/migrations/${migration}`, import.meta.url),
        "utf8",
      ),
    );
  }
  equal((await db.query("select onboarding_completed,education_system from public.profiles where id='33333333-3333-4333-8333-333333333333'")).rows[0], {onboarding_completed:true,education_system:null}, 'additive migration preserves legacy completed profile');
  await db.query(
    "insert into auth.users(id, raw_user_meta_data) values ($1, $2), ($3, $4)",
    [
      first,
      JSON.stringify({ display_name: "Student One" }),
      second,
      JSON.stringify({ display_name: "Student Two" }),
    ],
  );
  await asUser(first);
  equal(
    (await profile()).display_name,
    "Student One",
    "signup trigger copies display name",
  );
  equal(
    (
      await db.query(
        "select count(*)::integer as count from public.user_settings",
      )
    ).rows[0].count,
    1,
    "settings are private and provisioned",
  );
  await rejects(
    "select public.save_onboarding_step(4, '{\"minutes\":120}')",
    "22023",
    "steps cannot be skipped",
  );
  await rejects(
    "select public.complete_onboarding('en', 'light', 'blue')",
    "22023",
    "cannot complete an empty profile",
  );
  await step(1, { name: "Edited Name" });
  await step(2, { stage: "preparatory" });
  await rejects(
    'select public.save_onboarding_step(3, \'{"year":"secondary_1"}\')',
    "23514",
    "stage/year mismatch rejected",
  );
  await step(3, { year: "prep_2" });
  equal(
    [(await profile()).onboarding_step, (await profile()).school_year],
    [4, "prep_2"],
    "completed step persists for resume",
  );
  await step(2, { stage: "secondary" });
  equal(
    (await profile()).school_year,
    null,
    "changing stage clears incompatible year",
  );
  await step(3, { year: "secondary_3", education_system: "general_secondary", academic_branch: "science" });
  await rejects(
    "select public.save_onboarding_step(4, '{\"minutes\":721}')",
    "22023",
    "invalid custom goal rejected",
  );
  await step(4, { minutes: 150 });
  await rejects(
    "select public.save_onboarding_step(5, '{\"subjects\":[]}')",
    "22023",
    "empty subject selection rejected",
  );
  await step(5, { subjects: [" Mathematics ", "mathematics", "Arabic"] });
  equal(
    (await profile()).onboarding_subjects.length,
    2,
    "draft names normalized and deduplicated",
  );
  equal(
    (await profile()).onboarding_completed,
    false,
    "draft does not mark completion",
  );
  // Force a late validation failure after settings are written, then verify rollback.
  await db.query("update public.profiles set onboarding_subjects = array['']");
  await rejects(
    "select public.complete_onboarding('ar','dark','green')",
    "22023",
    "late failure rejected",
  );
  equal(
    (await db.query("select theme from public.user_settings")).rows[0].theme,
    "system",
    "transaction rolls back preferences",
  );
  equal(
    (await profile()).onboarding_completed,
    false,
    "transaction rolls back completion",
  );
  await step(5, { subjects: ["Mathematics", "Arabic"] });
  await complete();
  await complete();
  equal((await profile()).onboarding_completed, true, "completion persisted");
  equal(
    (await db.query("select count(*)::integer as count from public.subjects"))
      .rows[0].count,
    2,
    "completion retry does not duplicate subjects",
  );
  equal(
    (await db.query("select locale, theme, accent from public.user_settings"))
      .rows[0],
    { locale: "ar", theme: "dark", accent: "green" },
    "all appearance settings persisted",
  );
  const subject = (await db.query("select id from public.subjects limit 1"))
    .rows[0].id;
  await db.query(
    "insert into public.tasks(user_id,subject_id,title) values ($1,$2,'Study')",
    [first, subject],
  );
  await db.query(
    "insert into public.study_blocks(user_id,title,starts_at,ends_at) values ($1,'Study',now(),now()+interval '1 hour')",
    [first],
  );
  await db.query(
    "insert into public.focus_sessions(user_id,started_at) values ($1,now())",
    [first],
  );
  const tables = [
    "profiles",
    "user_settings",
    "subjects",
    "tasks",
    "study_blocks",
    "focus_sessions",
  ];
  const progressionTables = ["progression_profiles", "progression_reward_events"];
  const achievementTables = ["user_achievements"];
  for (const table of progressionTables) {
    equal(
      (await db.query("select relrowsecurity from pg_class where oid=$1::regclass", [`public.${table}`])).rows[0].relrowsecurity,
      true,
      `${table}: RLS enabled`,
    );
    equal(
      (await db.query("select count(*)::integer as count from pg_policies where schemaname='public' and tablename=$1", [table])).rows[0].count,
      1,
      `${table}: ownership policy exists`,
    );
    equal(
      (await db.query("select has_table_privilege('authenticated',$1,'select')", [`public.${table}`])).rows[0].has_table_privilege,
      true,
      `${table}: authenticated select grant exists`,
    );
    equal(
      (await db.query("select has_table_privilege('authenticated',$1,'insert')", [`public.${table}`])).rows[0].has_table_privilege,
      false,
      `${table}: authenticated insert grant absent`,
    );
    await rejects(`insert into public.${table} default values`, "42501", `${table}: direct insert denied`);
    await rejects(`update public.${table} set ${table === "progression_profiles" ? "total_xp=total_xp" : "xp=xp"}`, "42501", `${table}: direct update denied`);
    await rejects(`delete from public.${table}`, "42501", `${table}: direct delete denied`);
  }
  await db.exec("reset role");
  await rejects(`insert into public.progression_profiles(user_id,total_xp) values ('${first}',-1)`, "23514", "negative XP rejected");
  await rejects(`insert into public.progression_profiles(user_id,coins) values ('${first}',-1)`, "23514", "negative coins rejected");
  await rejects(`insert into public.progression_profiles(user_id,construction_points) values ('${first}',-1)`, "23514", "negative construction points rejected");
  await rejects(`insert into public.progression_reward_events(user_id,event_type,source_id,xp) values ('${first}','unknown','source',1)`, "23514", "invalid event type rejected");
  await rejects(`insert into public.progression_reward_events(user_id,event_type,source_id,xp) values ('${first}','task_completed','',1)`, "23514", "empty reward source rejected");
  await rejects(`insert into public.progression_reward_events(user_id,event_type,source_id) values ('${first}','task_completed','zero')`, "23514", "all-zero reward rejected");
  await db.query("insert into public.progression_reward_events(user_id,event_type,source_id,xp) values ($1,'task_completed','constraint-test',1)",[first]);
  await rejects(`insert into public.progression_reward_events(user_id,event_type,source_id,xp) values ('${first}','task_completed','constraint-test',1)`, "23505", "reward identity is unique");
  await db.query("delete from public.progression_reward_events where user_id=$1 and source_id='constraint-test'", [first]);
  await asUser(first);
  for (const table of achievementTables) {
    equal(
      (await db.query("select relrowsecurity from pg_class where oid=$1::regclass", [`public.${table}`])).rows[0].relrowsecurity,
      true,
      `${table}: RLS enabled`,
    );
    equal(
      (await db.query("select count(*)::integer as count from pg_policies where schemaname='public' and tablename=$1", [table])).rows[0].count,
      1,
      `${table}: ownership policy exists`,
    );
    equal(
      (await db.query("select has_table_privilege('authenticated',$1,'select')", [`public.${table}`])).rows[0].has_table_privilege,
      true,
      `${table}: authenticated select grant exists`,
    );
    await rejects(`insert into public.${table} default values`, "42501", `${table}: direct insert denied`);
    await rejects(`update public.${table} set unlocked_at=now()`, "42501", `${table}: direct update denied`);
    await rejects(`delete from public.${table}`, "42501", `${table}: direct delete denied`);
  }
  await asUser(first);
  await asUser(second);
  for (const table of tables) {
    const owner = table === "profiles" ? "id" : "user_id";
    equal(
      (
        await db.query(
          `select count(*)::integer as count from public.${table} where ${owner} = '${first}'`,
        )
      ).rows[0].count,
      0,
      `${table}: cross-user reads denied`,
    );
    equal(
      (
        await db.query(
          `update public.${table} set updated_at = now() where ${owner} = '${first}' returning ${owner}`,
        )
      ).rows.length,
      0,
      `${table}: cross-user updates denied`,
    );
    equal(
      (
        await db.query(
          `delete from public.${table} where ${owner} = '${first}' returning ${owner}`,
        )
      ).rows.length,
      0,
      `${table}: cross-user deletes denied`,
    );
  }
  await rejects(
    `insert into public.subjects(user_id,name) values ('${first}','Intrusion')`,
    "42501",
    "forged owner inserts denied",
  );
  await rejects(
    `insert into public.tasks(user_id,subject_id,title) values ('${second}','${subject}','Intrusion')`,
    "23503",
    "cross-owner foreign keys rejected",
  );
  await asUser(first);
  await rejects(
    `update public.subjects set user_id = '${second}'`,
    "42501",
    "ownership cannot be reassigned",
  );
  // Phase 3: safe subject removal, unique active names and date-only deadlines.
  equal((await db.query("select public.remove_subject($1) as archived",[subject])).rows[0].archived,true,"in-use subject archives");
  equal((await db.query("select subject_id from public.tasks limit 1")).rows[0].subject_id,subject,"archiving retains task association");
  await db.query("insert into public.subjects(user_id,name) values ($1,'Unique Subject')",[first]);
  await rejects(`insert into public.subjects(user_id,name) values ('${first}',' unique subject ')`,"23505","active duplicate names rejected");
  const unused=(await db.query("select id from public.subjects where name='Unique Subject'")).rows[0].id;
  equal((await db.query("select public.remove_subject($1) as archived",[unused])).rows[0].archived,false,"unused subject deletes safely");
  await db.query("insert into public.subjects(user_id,name) values ($1,'Mastery Subject')",[first]);
  const masterySubject=(await db.query("select id from public.subjects where name='Mastery Subject' and user_id=$1",[first])).rows[0].id;
  await db.query("insert into public.tasks(user_id,title,due_on) values ($1,'Date only','2026-09-14')",[first]);
  await rejects(`insert into public.tasks(user_id,title,due_on,due_at) values ('${first}','Invalid','2026-09-14',now())`,"23514","date-only and timed deadlines are exclusive");
  await rejects(`insert into public.study_blocks(user_id,title,starts_at,ends_at,time_zone) values ('${first}','Invalid',now(),now()+interval '1 hour','Invalid/Zone')`,"23514","invalid recurrence time zone rejected");
  await asUser(second);
  await rejects(`select public.remove_subject('${subject}')`,"P0002","cross-user removal RPC denied");
  // Phase 4: real lifecycle, retry safety and ownership. Time is advanced only
  // inside this isolated test database; production never accepts client elapsed time.
  await asUser(first);
  const fid='44444444-4444-4444-8444-444444444444';
  const transition=async(action,id=fid)=> (await db.query('select public.focus_transition($1,$2) as value',[action,id])).rows[0].value.session;
  let focus=await transition('start');
  equal(focus.timer_state,'running','focus starts');
  equal((await transition('start')).id,fid,'start retry returns same session');
  equal((await transition('start','55555555-5555-4555-8555-555555555555')).id,fid,'second tab gets existing active timer');
  await db.query("update public.focus_sessions set started_at=now()-interval '80 seconds',running_since=now()-interval '80 seconds' where id=$1",[fid]);
  focus=await transition('pause');
  equal(focus.accumulated_seconds>=80,true,'pause records elapsed seconds');
  const paused=focus.accumulated_seconds;
  equal((await transition('pause')).accumulated_seconds,paused,'pause retry does not count paused time');
  await transition('resume');
  await db.query("update public.focus_sessions set running_since=now()-interval '40 seconds' where id=$1",[fid]);
  focus=await transition('finish');
  equal(focus.completed,true,'manual valid time completes');
  equal(focus.duration_seconds>=120&&focus.duration_seconds<125,true,'manual end saves actual time');
  equal((await transition('finish')).duration_seconds,focus.duration_seconds,'duplicate finish cannot double count');
  const validRewardSession = '66666666-6666-4666-8666-666666666666';
  await db.query(
    `insert into public.focus_sessions(id,user_id,subject_id,started_at,ended_at,duration_seconds,completed,timer_state,planned_seconds,accumulated_seconds)
     values ($1,$2,$3,now()-interval '25 minutes',now(),1500,true,'completed',1500,1500)`,
    [validRewardSession, first, masterySubject],
  );
  const focusReward = (await db.query("select public.claim_focus_progression_reward($1) as value", [validRewardSession])).rows[0].value;
  equal(focusReward.awarded, true, "25-minute focus reward is awarded");
  equal(focusReward.reward, { xp: 25, coins: 5, constructionPoints: 5 }, "25-minute focus reward values are trusted");
  equal((await db.query("select subject_id from public.progression_reward_events where user_id=$1 and source_id=$2", [first, validRewardSession])).rows[0].subject_id, masterySubject, "focus reward subject attribution is derived");
  const duplicateFocusReward = (await db.query("select public.claim_focus_progression_reward($1) as value", [validRewardSession])).rows[0].value;
  equal(duplicateFocusReward.reason, "already_awarded", "duplicate focus reward is idempotent");
  equal((await db.query("select count(*)::integer as count from public.progression_reward_events where user_id=$1 and event_type='focus_completed'", [first])).rows[0].count, 1, "duplicate focus reward does not duplicate ledger");
  const shortSession = '77777777-7777-4777-8777-777777777777';
  await db.query(`insert into public.focus_sessions(id,user_id,subject_id,started_at,ended_at,duration_seconds,completed) values ($1,$2,$3,now()-interval '30 seconds',now(),30,true)`, [shortSession, first, masterySubject]);
  await rejects(`select public.claim_focus_progression_reward('${shortSession}')`, "P0002", "too-short focus reward denied");
  const incompleteSession = '88888888-8888-4888-8888-888888888888';
  await db.query(`insert into public.focus_sessions(id,user_id,subject_id,started_at,duration_seconds,completed,timer_state,planned_seconds,accumulated_seconds) values ($1,$2,$3,now(),0,false,'paused',300,0)`, [incompleteSession, first, masterySubject]);
  await rejects(`select public.claim_focus_progression_reward('${incompleteSession}')`, "P0002", "incomplete focus reward denied");
  const discardedSession = '99999999-9999-4999-8999-999999999999';
  await db.query(`insert into public.focus_sessions(id,user_id,subject_id,started_at,ended_at,duration_seconds,completed,timer_state,planned_seconds,accumulated_seconds) values ($1,$2,$3,now()-interval '30 seconds',now(),30,false,'discarded',300,30)`, [discardedSession, first, masterySubject]);
  await rejects(`select public.claim_focus_progression_reward('${discardedSession}')`, "P0002", "discarded focus reward denied");
  const unassignedFocusSession = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  await db.query(`insert into public.focus_sessions(id,user_id,started_at,ended_at,duration_seconds,completed) values ($1,$2,now()-interval '10 minutes',now(),600,true)`, [unassignedFocusSession, first]);
  const unassignedFocusReward = (await db.query("select public.claim_focus_progression_reward($1) as value", [unassignedFocusSession])).rows[0].value;
  equal(unassignedFocusReward.awarded, true, "unassigned focus reward is still global");
  equal((await db.query("select subject_id from public.progression_reward_events where user_id=$1 and source_id=$2", [first, unassignedFocusSession])).rows[0].subject_id, null, "unassigned focus has no fake subject attribution");
  const progress=(await db.query('select public.focus_progress() as value')).rows[0].value;
  equal(progress.totalSeconds>=focus.duration_seconds,true,'progress includes finished time');
  await rejects(`update public.user_settings set focus_minutes=0 where user_id='${first}'`,'23514','invalid timer settings rejected');
  await asUser(second);
  await rejects(`select public.claim_focus_progression_reward('${validRewardSession}')`, "P0002", "cross-user focus reward denied");
  equal((await db.query('select * from public.focus_sessions where id=$1',[fid])).rows.length,0,'focus history private');
  await step(1,{name:'Student Two'}); await step(2,{stage:'secondary'}); await step(3,{year:'secondary_2',education_system:'general_secondary',academic_branch:'scientific'}); await step(4,{minutes:120}); await step(5,{subjects:['Science']}); await complete();
  await rejects(`select public.focus_transition('finish','${fid}')`,'P0002','foreign completion denied');
  await rejects(`insert into public.focus_sessions(user_id,subject_id,started_at) values ('${second}','${subject}',now())`,'23503','focus foreign subject denied');
  await asUser(first);
  const taskid=(await db.query("select id from public.tasks where title='Study' and user_id=$1", [first])).rows[0].id;
  await db.query("insert into public.tasks(user_id,subject_id,title) values ($1,$2,'Mastery Task')", [first, masterySubject]);
  const masteryTask=(await db.query("select id from public.tasks where title='Mastery Task' and user_id=$1", [first])).rows[0].id;
  await db.query("insert into public.tasks(user_id,title) values ($1,'Global Task')", [first]);
  const unassignedTask=(await db.query("select id from public.tasks where title='Global Task' and user_id=$1", [first])).rows[0].id;
  await db.query("update public.tasks set status='completed',completed_at=now() where id=$1 and user_id=$2", [taskid, first]);
  const taskReward = (await db.query("select public.claim_task_progression_reward($1) as value", [taskid])).rows[0].value;
  equal(taskReward.awarded, true, "completed task reward is awarded");
  equal(taskReward.reward, { xp: 15, coins: 2, constructionPoints: 1 }, "task reward values are trusted");
  const duplicateTaskReward = (await db.query("select public.claim_task_progression_reward($1) as value", [taskid])).rows[0].value;
  equal(duplicateTaskReward.reason, "already_awarded", "duplicate task reward is idempotent");
  equal((await db.query("select count(*)::integer as count from public.progression_reward_events where user_id=$1 and event_type='task_completed' and source_id=$2", [first, taskid])).rows[0].count, 1, "duplicate task reward does not duplicate ledger");
  equal((await db.query("select subject_id from public.progression_reward_events where user_id=$1 and source_id=$2", [first, taskid])).rows[0].subject_id, subject, "archived task attribution is preserved");
  await rejects(`select public.claim_task_progression_reward('${unassignedTask}')`, "P0002", "incomplete task reward denied");
  await db.query("update public.tasks set status='completed',completed_at=now() where id=$1 and user_id=$2", [masteryTask, first]);
  const masteryTaskReward = (await db.query("select public.claim_task_progression_reward($1) as value", [masteryTask])).rows[0].value;
  equal(masteryTaskReward.awarded, true, "subject task reward is awarded");
  equal((await db.query("select subject_id from public.progression_reward_events where user_id=$1 and source_id=$2", [first, masteryTask])).rows[0].subject_id, masterySubject, "task reward subject attribution is derived");
  await db.query("update public.tasks set status='completed',completed_at=now() where id=$1 and user_id=$2", [unassignedTask, first]);
  const unassignedTaskReward = (await db.query("select public.claim_task_progression_reward($1) as value", [unassignedTask])).rows[0].value;
  equal(unassignedTaskReward.awarded, true, "unassigned task reward is still global");
  equal((await db.query("select subject_id from public.progression_reward_events where user_id=$1 and source_id=$2", [first, unassignedTask])).rows[0].subject_id, null, "unassigned task has no fake subject attribution");
  await db.query("insert into public.tasks(user_id,subject_id,title) values ($1,$2,'Incomplete Mastery Task')", [first, masterySubject]);
  const balances = (await db.query("select total_xp,coins,construction_points from public.progression_profiles where user_id=$1", [first])).rows[0];
  equal(balances, { total_xp: 80, coins: 8, construction_points: 5 }, "cached balances include automatic Focus Tower build");
  equal((await db.query("select sum(xp)::integer as total_xp,(sum(coins)-(select coalesce(sum(coins),0) from public.city_transactions where user_id=$1))::integer as coins,(sum(construction_points)-(select coalesce(sum(construction_points),0) from public.city_transactions where user_id=$1))::integer as construction_points from public.progression_reward_events where user_id=$1", [first])).rows[0], balances, "balances match earned rewards minus City spending");
  const masteryRows = (await db.query("select public.get_subject_mastery() as value")).rows[0].value;
  const masteryById = Object.fromEntries(masteryRows.map((row) => [row.subjectId, row]));
  equal(masteryById[masterySubject], {
    subjectId: masterySubject,
    subjectName: "Mastery Subject",
    archivedAt: null,
    totalXp: 40,
    totalStudyMinutes: 25,
    completedFocusSessions: 1,
    completedTasks: 1,
  }, "subject mastery aggregates trusted activity");
  equal(masteryById[subject].totalXp, 15, "archived subject retains historical mastery XP");
  equal(masteryById[masterySubject].completedFocusSessions, 1, "incomplete and discarded focus sessions do not count");
  await rejects(`update public.progression_reward_events set subject_id='${masterySubject}' where user_id='${first}'`, "42501", "client cannot alter reward subject attribution");
  const firstAchievementEvaluation = (await db.query("select public.evaluate_progression_achievements() as value")).rows[0].value;
  const firstAchievementKeys = firstAchievementEvaluation.map((row) => row.achievementKey).sort();
  equal(firstAchievementKeys, ["first_focus", "first_task"], "initial achievements use canonical activity");
  equal((await db.query("select count(*)::integer as count from public.user_achievements where user_id=$1 and achievement_key='level_2'", [first])).rows[0].count, 0, "insufficient XP does not unlock level 2");
  const firstAchievementRepeat = (await db.query("select public.evaluate_progression_achievements() as value")).rows[0].value;
  equal(firstAchievementRepeat, [], "repeated achievement evaluation is idempotent");
  for (const sessionId of ['b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002']) {
    await db.query(`insert into public.focus_sessions(id,user_id,subject_id,started_at,ended_at,duration_seconds,completed,timer_state,planned_seconds,accumulated_seconds) values ($1,$2,$3,now()-interval '30 minutes',now(),1800,true,'completed',1800,1800)`, [sessionId, first, masterySubject]);
    await db.query("select public.claim_focus_progression_reward($1)", [sessionId]);
  }
  for (let index = 0; index < 7; index++) {
    const task = (await db.query("insert into public.tasks(user_id,title,status,completed_at) values ($1,$2,'completed',now()) returning id", [first, `Achievement Task ${index}`])).rows[0];
    await db.query("select public.claim_task_progression_reward($1)", [task.id]);
  }
  const secondAchievementEvaluation = (await db.query("select public.evaluate_progression_achievements() as value")).rows[0].value;
  const secondAchievementKeys = secondAchievementEvaluation.map((row) => row.achievementKey).sort();
  equal(secondAchievementKeys, ["first_subject_level_2", "focus_5", "focus_60_minutes", "level_2", "tasks_10"], "focus, task, level, and subject achievements unlock from canonical data");
  const achievementCountBeforeRepeat = (await db.query("select count(*)::integer as count from public.user_achievements where user_id=$1", [first])).rows[0].count;
  equal((await db.query("select public.evaluate_progression_achievements() as value")).rows[0].value.map((row) => row.achievementKey), ["level_5"], "newly eligible level achievement unlocks once");
  equal((await db.query("select count(*)::integer as count from public.user_achievements where user_id=$1", [first])).rows[0].count, achievementCountBeforeRepeat + 1, "newly eligible evaluation adds one achievement row");
  const balanceAfterNewEligibility = (await db.query("select total_xp,coins,construction_points from public.progression_profiles where user_id=$1", [first])).rows[0];
  equal((await db.query("select public.evaluate_progression_achievements() as value")).rows[0].value, [], "fully evaluated achievements are idempotent");
  equal((await db.query("select total_xp,coins,construction_points from public.progression_profiles where user_id=$1", [first])).rows[0], balanceAfterNewEligibility, "repeated evaluation does not duplicate progression rewards");
  for (let index = 0; index < 13; index++) {
    const sessionId = `c0000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
    await db.query(`insert into public.focus_sessions(id,user_id,started_at,ended_at,duration_seconds,completed) values ($1,$2,now()-interval '25 minutes',now(),1500,true)`, [sessionId, first]);
    await db.query("select public.claim_focus_progression_reward($1)", [sessionId]);
  }
  const finalAchievementEvaluation = (await db.query("select public.evaluate_progression_achievements() as value")).rows[0].value;
  equal(finalAchievementEvaluation.map((row) => row.achievementKey).sort(), ["focus_300_minutes"], "long-term focus achievement unlocks");
  equal((await db.query("select count(*)::integer as count from public.user_achievements where user_id=$1", [first])).rows[0].count, 9, "all catalog achievements unlock exactly once");
  equal((await db.query("select count(*)::integer as count from public.progression_reward_events where user_id=$1 and event_type='achievement_unlocked'", [first])).rows[0].count, 9, "achievement and reward ledgers stay consistent");
  equal((await db.query("select total_xp,coins,construction_points from public.progression_profiles where user_id=$1", [first])).rows[0], (await db.query("select sum(xp)::integer as total_xp,(sum(coins)-(select coalesce(sum(coins),0) from public.city_transactions where user_id=$1))::integer as coins,(sum(construction_points)-(select coalesce(sum(construction_points),0) from public.city_transactions where user_id=$1))::integer as construction_points from public.progression_reward_events where user_id=$1", [first])).rows[0], "achievement rewards minus City spending reconcile with cached balances");
  await asUser(second);
  await rejects(`select public.claim_task_progression_reward('${taskid}')`, "P0002", "cross-user task reward denied");
  for (const table of progressionTables)
    equal((await db.query(`select count(*)::integer as count from public.${table} where user_id='${first}'`)).rows[0].count, 0, `${table}: cross-user reads denied`);
  equal((await db.query(`select count(*)::integer as count from public.user_achievements where user_id='${first}'`)).rows[0].count, 0, "user achievements: cross-user reads denied");
  const secondMasteryRows = (await db.query("select public.get_subject_mastery() as value")).rows[0].value;
  equal(secondMasteryRows.some((row) => row.subjectId === masterySubject), false, "subject mastery read model is owner-scoped");
  await db.query("insert into public.focus_sessions(id,user_id,started_at,duration_seconds,completed,timer_state,planned_seconds,accumulated_seconds) values ('d0000000-0000-4000-8000-000000000001',$1,now(),0,false,'paused',300,0)", [second]);
  await db.query("insert into public.focus_sessions(id,user_id,started_at,ended_at,duration_seconds,completed,timer_state,planned_seconds,accumulated_seconds) values ('d0000000-0000-4000-8000-000000000002',$1,now()-interval '30 seconds',now(),30,false,'discarded',300,30)", [second]);
  equal((await db.query("select public.evaluate_progression_achievements() as value")).rows[0].value, [], "incomplete and discarded focus do not unlock achievements");
  await db.query("insert into public.focus_sessions(id,user_id,started_at,ended_at,duration_seconds,completed) values ('d0000000-0000-4000-8000-000000000003',$1,now()-interval '1 minute',now(),60,true)", [second]);
  await db.query("select public.claim_focus_progression_reward('d0000000-0000-4000-8000-000000000003')");
  equal((await db.query("select public.evaluate_progression_achievements() as value")).rows[0].value.map((row) => row.achievementKey), ["first_focus"], "cross-user activity is evaluated only for its owner");
  await asUser(first);
  equal((await db.query("select count(*)::integer as count from public.user_achievements where user_id=$1", [first])).rows[0].count, 9, "another user's activity cannot change owner achievements");
  await asUser(second);
  await rejects(`insert into public.focus_sessions(user_id,task_id,started_at) values ('${second}','${taskid}',now())`,'23503','focus foreign task denied');
  await db.exec("reset role; set role anon;");
  for (const table of tables)
    await rejects(
      `select * from public.${table}`,
      "42501",
      `${table}: anonymous reads denied`,
    );
  for (const table of progressionTables)
    await rejects(`select * from public.${table}`, "42501", `${table}: anonymous reads denied`);
  for (const table of achievementTables)
    await rejects(`select * from public.${table}`, "42501", `${table}: anonymous reads denied`);
  await rejects(
    "select public.complete_onboarding('en','light','blue')",
    "42501",
    "anonymous RPC denied",
  );
  await asUser(first);
  const educationCases=JSON.parse(await readFile(new URL('./education-cases.json',import.meta.url),'utf8'));
  const namesBefore=(await db.query('select name from public.subjects order by name')).rows;
  for(const e of educationCases){
    const value={...e,display_name:'Edited Name',daily_goal_minutes:120};
    await db.query('select public.save_education($1::jsonb)',[JSON.stringify(value)]);
    const saved=await profile();
    for(const [key,value] of Object.entries(e)) equal(saved[key],value,'education persists '+key);
  }
  equal((await db.query('select name from public.subjects order by name')).rows,namesBefore,'education editing preserves all existing subjects');
  const engineering={...educationCases.find(e=>e.academic_track==='engineering_computer_science'&&e.school_year==='secondary_2'),display_name:'Edited Name',daily_goal_minutes:120};
  await assert.rejects(db.query('select public.save_education($1::jsonb)',[JSON.stringify({...engineering,specialization_subject:'physics'})]),e=>e.code==='22023');checks++;
  await db.query('select public.save_education($1::jsonb,$2::text[])',[JSON.stringify(engineering),['Programming & AI']]);
  await db.query('select public.save_education($1::jsonb,$2::text[])',[JSON.stringify(engineering),['Programming & AI']]);
  equal((await db.query("select count(*)::int n from public.subjects where name='Programming & AI'")).rows[0].n,1,'subject addition is retry-safe');
  await rejects("update public.profiles set specialization_subject='physics'",'23514','direct invalid elective blocked');
  for(const accent of ['violet','blue','green','orange']){
    await db.query('update public.user_settings set accent=$1',[accent]);
    equal((await db.query('select accent,locale from public.user_settings')).rows[0],{accent,locale:'ar'},'accent persists without overwriting locale');
  }
  await asUser(second);
  equal((await db.query('select education_system from public.profiles where id=$1',[first])).rows.length,0,'new education data is private');
  await db.exec('reset role;set role anon;');
  await rejects("select public.save_education('{}')",'42501','anonymous education writes denied');
  for (const [index,e] of educationCases.entries()) {
    const id='70000000-0000-4000-8000-'+String(index+1).padStart(12,'0');
    await db.exec('reset role');
    await db.query('insert into auth.users(id) values ($1)',[id]);
    await asUser(id);
    await step(1,{name:'Curriculum Student'}); await step(2,{stage:e.school_stage});
    await step(3,{...e,year:e.school_year}); await step(4,{minutes:120});
    await step(5,{subjects:['Custom retained subject']}); await complete();
    const saved=await profile();
    for (const [key,value] of Object.entries(e)) equal(saved[key],value,'onboarding education persists '+key);
    equal(saved.onboarding_completed,true,'all paths can finish onboarding');
    equal((await db.query('select name from public.subjects')).rows[0].name,'Custom retained subject','custom subject survives completion');
  }
  for (const year of ['secondary_1','secondary_2','secondary_3']) {
    const id='80000000-0000-4000-8000-'+year.slice(-1).padStart(12,'0');
    await db.exec('reset role'); await db.query('insert into auth.users(id) values ($1)',[id]); await asUser(id);
    await step(1,{name:'Legacy Client'}); await step(2,{stage:'secondary'});
    await step(3,{year}); await step(4,{minutes:120}); await step(5,{subjects:['Preserved subject']}); await complete();
    equal((await profile()).onboarding_completed,true,'deployed year-only client completes '+year);
    equal((await profile()).education_system,null,'legacy education is unknown, not guessed');
    await db.query("update public.profiles set school_year='secondary_1'");
    equal((await profile()).school_year,'secondary_1','old profile edit remains supported');
  }
  await db.query('select public.save_education($1::jsonb)',[JSON.stringify(engineering)]);
  await db.query("update public.profiles set school_year='secondary_3'");
  equal((await profile()).education_system,null,'legacy year edit clears incompatible dependent answers');
  await assert.rejects(db.query('select public.save_education($1::jsonb)',[JSON.stringify({...engineering,education_system:null})]),e=>e.code==='22023');checks++;
  await testCity({ db, equal, rejects, asUser });
  await testAutomaticCity({ db, equal, rejects, asUser });
  console.log(
    `PASS: ${checks} PostgreSQL migration, transaction, and ownership assertions.`,
  );
} finally {
  await db.close();
}
