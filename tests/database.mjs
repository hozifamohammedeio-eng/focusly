// Executes the real migrations in embedded PostgreSQL. auth.users/auth.uid are
// a minimal platform harness; this is NOT a live Supabase Auth integration test.
// Usage: node tests/database.mjs <path-to-pglite/dist/index.js>
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

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
    `insert into public.focus_sessions(id,user_id,started_at,ended_at,duration_seconds,completed,timer_state,planned_seconds,accumulated_seconds)
     values ($1,$2,now()-interval '25 minutes',now(),1500,true,'completed',1500,1500)`,
    [validRewardSession, first],
  );
  const focusReward = (await db.query("select public.claim_focus_progression_reward($1) as value", [validRewardSession])).rows[0].value;
  equal(focusReward.awarded, true, "25-minute focus reward is awarded");
  equal(focusReward.reward, { xp: 25, coins: 5, constructionPoints: 5 }, "25-minute focus reward values are trusted");
  const duplicateFocusReward = (await db.query("select public.claim_focus_progression_reward($1) as value", [validRewardSession])).rows[0].value;
  equal(duplicateFocusReward.reason, "already_awarded", "duplicate focus reward is idempotent");
  equal((await db.query("select count(*)::integer as count from public.progression_reward_events where user_id=$1 and event_type='focus_completed'", [first])).rows[0].count, 1, "duplicate focus reward does not duplicate ledger");
  const shortSession = '77777777-7777-4777-8777-777777777777';
  await db.query(`insert into public.focus_sessions(id,user_id,started_at,ended_at,duration_seconds,completed) values ($1,$2,now()-interval '30 seconds',now(),30,true)`, [shortSession, first]);
  await rejects(`select public.claim_focus_progression_reward('${shortSession}')`, "P0002", "too-short focus reward denied");
  const incompleteSession = '88888888-8888-4888-8888-888888888888';
  await db.query(`insert into public.focus_sessions(id,user_id,started_at,duration_seconds,completed,timer_state,planned_seconds,accumulated_seconds) values ($1,$2,now(),0,false,'paused',300,0)`, [incompleteSession, first]);
  await rejects(`select public.claim_focus_progression_reward('${incompleteSession}')`, "P0002", "incomplete focus reward denied");
  const discardedSession = '99999999-9999-4999-8999-999999999999';
  await db.query(`insert into public.focus_sessions(id,user_id,started_at,ended_at,duration_seconds,completed,timer_state,planned_seconds,accumulated_seconds) values ($1,$2,now()-interval '30 seconds',now(),30,false,'discarded',300,30)`, [discardedSession, first]);
  await rejects(`select public.claim_focus_progression_reward('${discardedSession}')`, "P0002", "discarded focus reward denied");
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
  const taskid=(await db.query('select id from public.tasks limit 1')).rows[0].id;
  await db.query("update public.tasks set status='completed',completed_at=now() where id=$1 and user_id=$2", [taskid, first]);
  const taskReward = (await db.query("select public.claim_task_progression_reward($1) as value", [taskid])).rows[0].value;
  equal(taskReward.awarded, true, "completed task reward is awarded");
  equal(taskReward.reward, { xp: 15, coins: 2, constructionPoints: 1 }, "task reward values are trusted");
  const duplicateTaskReward = (await db.query("select public.claim_task_progression_reward($1) as value", [taskid])).rows[0].value;
  equal(duplicateTaskReward.reason, "already_awarded", "duplicate task reward is idempotent");
  equal((await db.query("select count(*)::integer as count from public.progression_reward_events where user_id=$1 and event_type='task_completed' and source_id=$2", [first, taskid])).rows[0].count, 1, "duplicate task reward does not duplicate ledger");
  const balances = (await db.query("select total_xp,coins,construction_points from public.progression_profiles where user_id=$1", [first])).rows[0];
  equal(balances, { total_xp: 40, coins: 7, construction_points: 6 }, "cached balances match claimed ledger");
  equal((await db.query("select sum(xp)::integer as total_xp,sum(coins)::integer as coins,sum(construction_points)::integer as construction_points from public.progression_reward_events where user_id=$1", [first])).rows[0], balances, "balances match reward ledger");
  await asUser(second);
  await rejects(`select public.claim_task_progression_reward('${taskid}')`, "P0002", "cross-user task reward denied");
  for (const table of progressionTables)
    equal((await db.query(`select count(*)::integer as count from public.${table} where user_id='${first}'`)).rows[0].count, 0, `${table}: cross-user reads denied`);
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
  console.log(
    `PASS: ${checks} PostgreSQL migration, transaction, and ownership assertions.`,
  );
} finally {
  await db.close();
}
