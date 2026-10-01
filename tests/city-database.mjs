import { readFile } from "node:fs/promises";

// Runs inside the existing ephemeral PGlite harness, never a remote database.
export async function testCity({ db, equal, rejects, asUser }) {
  const owner = "91000000-0000-4000-8000-000000000001";
  const stranger = "91000000-0000-4000-8000-000000000002";
  let requestNumber = 0;
  const requestId = () => `92000000-0000-4000-8000-${String(++requestNumber).padStart(12, "0")}`;
  const call = async (action, key, request = requestId(), id = null, expected = null) =>
    (await db.query("select public.city_transaction($1,$2,$3,$4,$5) as result", [action, key, request, id, expected])).rows[0].result;
  const deny = (action, key, id = null, expected = null, code = "22023") => rejects(
    `select public.city_transaction('${action}','${key}','${requestId()}',${id ? `'${id}'` : "null"},${expected ?? "null"})`, code, `City denies ${action} ${key}`);
  const balances = async () => (await db.query("select coins::int, construction_points::int from public.progression_profiles where user_id=$1", [owner])).rows[0];
  const fund = async (coins, points) => {
    await db.exec("reset role");
    await db.query("update public.progression_profiles set coins=$2, construction_points=$3 where user_id=$1", [owner, coins, points]);
    await asUser(owner);
  };
  await db.exec("reset role");
  await db.query("insert into auth.users(id) values ($1),($2)", [owner, stranger]);
  await db.query("insert into public.progression_profiles(user_id,total_xp) values ($1,9999),($2,9999)", [owner, stranger]);
  const catalog = JSON.parse(await readFile(new URL("../src/features/city/catalog.json", import.meta.url), "utf8"));
  const sqlCatalog = (await db.query('select key, max_level as "maxLevel", coins, construction_points as "constructionPoints", metric, threshold from public.city_building_catalog order by key')).rows;
  equal(sqlCatalog, [...catalog].sort((a,b) => a.key.localeCompare(b.key)), "City SQL/domain catalog parity");
  for (const table of ["city_building_catalog", "user_city_buildings", "city_transactions"]) {
    equal((await db.query("select relrowsecurity from pg_class where oid=$1::regclass", [`public.${table}`])).rows[0].relrowsecurity, true, `${table} RLS enabled`);
    for (const privilege of ["INSERT", "UPDATE", "DELETE", "TRUNCATE"]) {
      equal((await db.query("select has_table_privilege('authenticated',$1,$2) as allowed", [`public.${table}`, privilege])).rows[0].allowed, false, `${table} denies ${privilege}`);
    }
  }
  await db.exec("set role anon");
  for (const table of ["city_building_catalog", "user_city_buildings", "city_transactions"])
    await rejects(`select * from public.${table}`, "42501", "anonymous City read denied");
  await deny("build", "knowledge_center", null, null, "42501");
  await asUser(owner);
  for (const table of ["city_building_catalog", "user_city_buildings", "city_transactions"]) {
    await rejects(`insert into public.${table} default values`, "42501", "direct City insert denied");
    await rejects(`delete from public.${table}`, "42501", "direct City delete denied");
  }
  await rejects("update public.user_city_buildings set level=100", "42501", "direct level write denied");
  await rejects("update public.city_transactions set coins=1", "42501", "spend ledger cannot be rewritten");
  await rejects("update public.city_building_catalog set coins=1", "42501", "client cannot set costs");
  await fund(100, 100);
  await deny("build", "knowledge_center"); // profile XP alone is not evidence
  equal(await balances(), { coins:100, construction_points:100 }, "locked build spends nothing");
  await db.exec("reset role");
  // Privileged fixture: canonical earned XP, not a client balance/eligibility claim.
  await db.query("insert into public.progression_reward_events(user_id,event_type,source_id,xp) values ($1,'achievement_unlocked','city-fixture',1000)", [owner]);
  await asUser(owner);
  await fund(9, 5); await deny("build", "knowledge_center");
  await fund(10, 4); await deny("build", "knowledge_center");
  equal((await db.query("select count(*)::int n from public.city_transactions")).rows[0].n, 0, "failed builds leave no spend history");
  await fund(50, 50);
  const buildRequest = requestId();
  const built = await call("build", "knowledge_center", buildRequest);
  equal(built.building.level, 1, "build creates level one");
  equal(built.building.user_id, owner, "build owner derived from identity");
  equal(built.cost, { coins:10, constructionPoints:5 }, "exact build cost");
  equal(await balances(), { coins:40, construction_points:45 }, "build deducts once");
  equal(await call("build", "knowledge_center", buildRequest), built, "build retry returns original receipt");
  await deny("build", "knowledge_center");
  await rejects(`select public.city_transaction('build','focus_tower','${buildRequest}')`, "22023", "request id payload mismatch denied");
  equal(await balances(), { coins:40, construction_points:45 }, "duplicate/new-ID rebuild cannot charge twice");
  const beforeRead = {
    balance: await balances(),
    transactions: (await db.query("select count(*)::int n from public.city_transactions")).rows[0].n,
  };
  await db.query("select building_key,level from public.user_city_buildings where user_id=$1", [owner]);
  await db.query("select building_key,target_level,source_reward_event_id from public.city_transactions where user_id=$1", [owner]);
  await db.query("select public.get_subject_mastery()");
  equal(await balances(), beforeRead.balance, "City and mastery reads never spend balances");
  equal((await db.query("select count(*)::int n from public.city_transactions")).rows[0].n, beforeRead.transactions, "City reads never create transactions");
  await asUser(stranger);
  equal((await db.query("select * from public.user_city_buildings")).rows.length, 0, "other user's buildings hidden");
  equal((await db.query("select * from public.city_transactions")).rows.length, 0, "other user's spend history hidden");
  await deny("upgrade", "knowledge_center", built.building.id, 1, "42501");
  await deny("build", "knowledge_center", built.building.id, 1);
  await deny("build", "knowledge_center"); // cannot use owner's canonical XP
  await asUser(owner);
  await deny("upgrade", "knowledge_center", built.building.id, 2);
  await deny("upgrade", "focus_tower", built.building.id, 1, "42501");
  const upgradeRequest = requestId();
  const upgraded = await call("upgrade", "knowledge_center", upgradeRequest, built.building.id, 1);
  equal(upgraded.building.level, 2, "upgrade increments exactly one level");
  equal(upgraded.building.built_at, built.building.built_at, "upgrade preserves built timestamp");
  equal(typeof upgraded.building.upgraded_at, "string", "upgrade timestamp recorded");
  equal(await balances(), { coins:20, construction_points:35 }, "upgrade deducts exact level-two cost");
  equal(await call("upgrade", "knowledge_center", upgradeRequest, built.building.id, 1), upgraded, "upgrade retry returns original receipt");
  await deny("upgrade", "knowledge_center", built.building.id, 1);
  await deny("upgrade", "knowledge_center", built.building.id, 2); // insufficient coins
  equal(await balances(), { coins:20, construction_points:35 }, "failed upgrades roll back all deductions");
  await fund(30, 15);
  const last = await call("upgrade", "knowledge_center", requestId(), built.building.id, 2);
  equal(last.building.level, 3, "max-level upgrade works");
  equal(await balances(), { coins:0, construction_points:0 }, "exact affordability never produces negative balances");
  await deny("upgrade", "knowledge_center", built.building.id, 3);
  equal((await db.query("select count(*)::int n from public.city_transactions")).rows[0].n, 3, "one receipt per successful level");

  // Inject a late failure to prove the debit and building mutation roll back together.
  await fund(100,100);
  await db.exec("reset role");
  await db.query("insert into public.focus_sessions(user_id,started_at,ended_at,duration_seconds,completed) values ($1,now()-interval '30 minutes',now(),1800,true)", [owner]);
  await db.exec(`alter table public.city_transactions add constraint city_test_failure check (user_id <> '${owner}' or building_key <> 'focus_tower')`);
  await asUser(owner);
  await deny("build", "focus_tower", null, null, "23514");
  equal(await balances(), { coins:100, construction_points:100 }, "late failure rolls back debit");
  equal((await db.query("select * from public.user_city_buildings where building_key='focus_tower'")).rows.length, 0, "late failure rolls back building");
  await db.exec("reset role; alter table public.city_transactions drop constraint city_test_failure");
  await asUser(owner);
  const focusRequest = requestId();
  const attempts = await Promise.all([call("build","focus_tower",focusRequest),call("build","focus_tower",focusRequest)]);
  equal(attempts[0], attempts[1], "queued simultaneous retries return identical receipts");
  equal(await balances(), { coins:95, construction_points:95 }, "queued retries only charge once");
  await deny("upgrade", "focus_tower", attempts[0].building.id, 1); // 30 minutes cannot satisfy level-two's 50 minutes
  equal(await balances(), { coins:95, construction_points:95 }, "locked upgrade leaves both balances intact");
  await deny("build", "library_district"); // unassigned/global XP does not count as subject XP
  await db.exec("reset role");
  const subject = (await db.query("insert into public.subjects(user_id,name) values ($1,'Arbitrary uncategorized subject') returning id", [owner])).rows[0].id;
  await db.query("insert into public.progression_reward_events(user_id,subject_id,event_type,source_id,xp) values ($1,$2,'task_completed','city-subject-fixture',225)", [owner, subject]);
  await asUser(owner);
  for (const key of ["library_district","science_lab","language_academy"]) {
    await fund(100,100);
    equal((await call("build",key)).building.level, 1, `${key} uses canonical generic mastery`);
  }
  await deny("build", "planner_hall");
  await db.exec("reset role");
  await db.query("insert into public.tasks(user_id,title,status,completed_at) select $1,'City task '||i,'completed',now() from generate_series(1,5) i", [owner]);
  await asUser(owner);
  equal((await call("build","planner_hall")).building.level, 1, "planner uses canonical completed tasks");
  await deny("build", "unknown");
  await deny("purchase", "knowledge_center");
  await rejects("select public.city_transaction('build','knowledge_center',null)", "22023", "missing idempotency key rejected");
  await rejects("select public.city_transaction(null,'knowledge_center',gen_random_uuid())", "22023", "missing action rejected");
  await rejects("select public.city_transaction('upgrade','knowledge_center',gen_random_uuid())", "22023", "upgrade requires an owned ID and expected level");
  await db.query("select set_config('request.jwt.claim.sub','',false)");
  await deny("build", "knowledge_center", null, null, "42501");
}
