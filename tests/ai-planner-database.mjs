export async function testAiPlanner({ db, equal, rejects, asUser }) {
  const owner = '97000000-0000-4000-8000-000000000001';
  const other = '97000000-0000-4000-8000-000000000002';
  await db.exec('reset role');
  await db.query('insert into auth.users(id) values ($1),($2)', [owner, other]);
  await db.query('update public.profiles set onboarding_completed=true where id in ($1,$2)', [owner, other]);
  const subject = (await db.query("insert into public.subjects(user_id,name) values($1,'AI test subject') returning id", [owner])).rows[0].id;
  const foreign = (await db.query("insert into public.subjects(user_id,name) values($1,'Foreign AI subject') returning id", [other])).rows[0].id;
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 1) % 7));
  const day = start.toISOString().slice(0, 10);
  const payload = {
    input: { zone: 'UTC', weekStart: day, dailyMinutes: 120, fixed: [
      { id: 'fixed-1', subjectId: subject, title: 'Fixed lecture', date: day, start: '10:00', end: '11:00', startInstant: `${day}T10:00:00Z`, endInstant: `${day}T11:00:00Z` },
    ], daysOff: [] },
    plan: { items: [{ id: 'item-1', subjectId: subject, title: 'AI study task', priority: 'high', estimatedMinutes: 45, isBacklog: false, deadline: null }],
      sessions: [{ id: 'session-1', workItemId: 'item-1', subjectId: subject, title: 'AI study session', date: day, start: '12:00', end: '12:45', startInstant: `${day}T12:00:00Z`, endInstant: `${day}T12:45:00Z` }] },
  };
  const request = '97000000-0000-4000-8000-000000000010';
  await asUser(owner);
  const first = (await db.query('select public.save_ai_weekly_plan($1,$2::jsonb) value', [request, JSON.stringify(payload)])).rows[0].value;
  equal(first, { tasks: 1, sessions: 2, alreadySaved: false }, 'atomic save creates one Task and two Planner blocks');
  equal((await db.query("select count(*)::integer n from public.study_blocks where title like 'AI %'")).rows[0].n, 1, 'AI flexible block is visible to owner');
  equal((await db.query("select count(*)::integer n from public.study_blocks where task_id is not null and title='AI study session'")).rows[0].n, 1, 'flexible block links to its authoritative Task');
  equal((await db.query('select public.save_ai_weekly_plan($1,$2::jsonb) value', [request, JSON.stringify(payload)])).rows[0].value.alreadySaved, true, 'same request is idempotent');
  const altered = structuredClone(payload);
  altered.plan.items[0].title = 'Changed after save';
  await rejects(`select public.save_ai_weekly_plan('${request}','${JSON.stringify(altered)}'::jsonb)`, '22023', 'request ID cannot be reused for a different plan');
  equal((await db.query("select count(*)::integer n from public.tasks where title='AI study task'")).rows[0].n, 1, 'replay does not duplicate Task');
  equal((await db.query('select count(*)::integer n from public.progression_reward_events where user_id=$1', [owner])).rows[0].n, 0, 'saving and replaying a plan award no XP or Coins');
  equal((await db.query('select count(*)::integer n from public.city_transactions where user_id=$1', [owner])).rows[0].n, 0, 'saving and replaying a plan do not progress City');
  const collision = structuredClone(payload);
  collision.plan.sessions[0].start = '10:30'; collision.plan.sessions[0].end = '11:15';
  collision.plan.sessions[0].startInstant = `${day}T10:30:00Z`; collision.plan.sessions[0].endInstant = `${day}T11:15:00Z`;
  await rejects(`select public.save_ai_weekly_plan('97000000-0000-4000-8000-000000000011','${JSON.stringify(collision)}'::jsonb)`, '23P01', 'fixed-event collision aborts save');
  equal((await db.query("select count(*)::integer n from public.tasks where title='AI study task'")).rows[0].n, 1, 'failed save rolls back all Tasks');
  const sunday = new Date(Date.parse(day + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10);
  const priorSunday = new Date(Date.parse(sunday + 'T12:00:00Z') - 7 * 86400000).toISOString().slice(0, 10);
  await db.query(`insert into public.study_blocks(user_id,subject_id,title,starts_at,ends_at,time_zone,repeat_weekly)
    values($1,$2,'Weekly class',$3::timestamptz,$4::timestamptz,'UTC',true)`, [owner, subject, `${priorSunday}T15:00:00Z`, `${priorSunday}T16:00:00Z`]);
  const weeklyCollision = structuredClone(payload);
  weeklyCollision.input.fixed = [];
  weeklyCollision.plan.sessions[0].date = sunday;
  weeklyCollision.plan.sessions[0].start = '15:30'; weeklyCollision.plan.sessions[0].end = '16:15';
  weeklyCollision.plan.sessions[0].startInstant = `${sunday}T15:30:00Z`; weeklyCollision.plan.sessions[0].endInstant = `${sunday}T16:15:00Z`;
  await rejects(`select public.save_ai_weekly_plan('97000000-0000-4000-8000-000000000013','${JSON.stringify(weeklyCollision)}'::jsonb)`, '23P01', 'weekly recurring class remains an immutable conflict');
  const badInstant = structuredClone(weeklyCollision);
  badInstant.plan.sessions[0].start = '17:00'; badInstant.plan.sessions[0].end = '17:45';
  badInstant.plan.sessions[0].startInstant = `${sunday}T18:00:00Z`; badInstant.plan.sessions[0].endInstant = `${sunday}T17:45:00Z`;
  await rejects(`select public.save_ai_weekly_plan('97000000-0000-4000-8000-000000000014','${JSON.stringify(badInstant)}'::jsonb)`, '23P01', 'database rejects an instant that does not match preview wall time');
  const partial = structuredClone(payload);
  partial.input.fixed = [];
  partial.plan.items[0].title = 'Partial task';
  partial.plan.sessions[0].date = sunday;
  partial.plan.sessions[0].start = '18:00'; partial.plan.sessions[0].end = '18:45';
  partial.plan.sessions[0].startInstant = `${sunday}T18:00:00Z`; partial.plan.sessions[0].endInstant = `${sunday}T18:45:00Z`;
  partial.plan.items.push({ ...partial.plan.items[0], id: 'item-2', title: 'Invalid later task', priority: 'critical' });
  partial.plan.sessions.push({ ...partial.plan.sessions[0], id: 'session-2', workItemId: 'item-2', start: '19:00', end: '19:45', startInstant: `${sunday}T19:00:00Z`, endInstant: `${sunday}T19:45:00Z` });
  await rejects(`select public.save_ai_weekly_plan('97000000-0000-4000-8000-000000000015','${JSON.stringify(partial)}'::jsonb)`, '22P02', 'late task failure aborts the entire transaction');
  equal((await db.query("select count(*)::integer n from public.tasks where title='Partial task'")).rows[0].n, 0, 'earlier Task insert rolls back after later failure');
  const foreignPayload = structuredClone(payload);
  foreignPayload.input.fixed = [];
  foreignPayload.plan.items[0].subjectId = foreign;
  foreignPayload.plan.sessions[0].subjectId = foreign;
  await rejects(`select public.save_ai_weekly_plan('97000000-0000-4000-8000-000000000012','${JSON.stringify(foreignPayload)}'::jsonb)`, '22023', 'cross-owner subject cannot be linked');
  await asUser(other);
  equal((await db.query("select count(*)::integer n from public.tasks where title='AI study task'")).rows[0].n, 0, 'other user cannot read saved AI Task');
  equal((await db.query("select count(*)::integer n from public.study_blocks where title='AI study session'")).rows[0].n, 0, 'other user cannot read saved AI block');
  await db.exec('reset role; set role anon');
  await rejects(`select public.save_ai_weekly_plan('${request}','${JSON.stringify(payload)}'::jsonb)`, '42501', 'anonymous role cannot call save RPC');
}
