// Replays the observed legacy schema and exact migration chain in isolated PostgreSQL.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const backup = JSON.parse(await readFile(new URL('../../outputs/Focusly-Pre-Reconciliation-Backup.json',import.meta.url),'utf8'));
const db = new PGlite();
const qi = s => '"'+s.replaceAll('"','""')+'"';
const file = p => readFile(new URL('../supabase/'+p,import.meta.url),'utf8');
try {
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to anon,authenticated;`);
 for (const t of backup.tables) {
  const cols = backup.columns.filter(c=>c.table_name===t.name).map(c=>`${qi(c.column_name)} ${qi(c.udt_schema)}.${qi(c.udt_name)}${c.column_default ? ' default '+c.column_default : ''}${c.is_nullable==='NO'?' not null':''}`);
  await db.exec(`create table public.${qi(t.name)} (${cols.join(',')});`);
 }
 // Primary/unique constraints must precede dependent foreign keys.
 for (const c of [...backup.constraints].sort((a,b)=>(a.type==='f')-(b.type==='f'))) await db.exec(`alter table public.${qi(c.table)} add constraint ${qi(c.name)} ${c.definition};`);
 for (const i of backup.indexes) if(!backup.constraints.some(c=>c.name===i.indexname&&['p','u'].includes(c.type))) await db.exec(i.indexdef);
 for (const f of backup.functions) await db.exec(f.definition);
 for (const t of backup.triggers) await db.exec(t.definition);
 for (const p of backup.policies) await db.exec(`create policy ${qi(p.policyname)} on public.${qi(p.tablename)} for ${p.cmd} to ${p.roles.map(qi).join(',')}${p.qual?' using ('+p.qual+')':''}${p.with_check?' with check ('+p.with_check+')':''};`);
 for (const t of backup.tables) await db.exec(`alter table public.${qi(t.name)} enable row level security; grant all on public.${qi(t.name)} to anon,authenticated;`);
 // Seed through the real legacy trigger, then copy backed-up application rows.
 for (const p of backup.profiles) await db.query('insert into auth.users(id) values ($1)',[p.id]);
 for (const table of ['profiles','user_preferences']) {
  await db.exec(`delete from public.${table}`);
  for(const row of backup[table]) {
   const keys=Object.keys(row);
   await db.query(`insert into public.${table} (${keys.map(qi)}) values (${keys.map((_,i)=>'$'+(i+1))})`,Object.values(row));
  }
 }
 const snapshot = (await db.query('select to_jsonb(p) row from public.profiles p')).rows;
 await db.exec(await file('reconciliation/20260914093239_preserve_legacy_schema.sql'));
 await db.exec(await file('migrations/20260913174507_create_focusly_foundation.sql'));
 await db.exec(await file('migrations/20260913183022_auth_onboarding.sql'));
 assert.deepEqual((await db.query('select to_jsonb(p) row from focusly_legacy.profiles p')).rows,snapshot);
 assert.equal((await db.query("select count(*)::int n from pg_trigger where tgrelid='auth.users'::regclass and not tgisinternal and tgenabled='O'")).rows[0].n,1);
 assert.equal((await db.query("select count(*)::int n from pg_constraint where contype='f' and confrelid in ('focusly_legacy.subjects'::regclass,'focusly_legacy.tasks'::regclass)")).rows[0].n,5);
 await db.exec('set role authenticated');
 await assert.rejects(db.query('select * from focusly_legacy.profiles'),e=>e.code==='42501');
 await assert.rejects(db.query('select * from public.user_preferences'),e=>e.code==='42501');
 await db.exec('reset role');
 if(process.argv[3]) {
  const sql=await file('migrations/'+process.argv[3]);
  await db.exec(sql); await db.exec(sql);
  const rows=(await db.query('select * from public.profiles')).rows;
  assert.equal(rows.length,backup.profiles.length);
  assert.equal(rows[0].display_name,backup.profiles[0].display_name?.trim()||null);
  assert.equal(rows[0].onboarding_completed,false);
  const settings=(await db.query('select * from public.user_settings')).rows;
  assert.equal(settings.length,1); assert.equal(settings[0].theme,'system');
  assert.equal(settings[0].accent,'violet');
  // Retry must not overwrite subsequent user changes.
  await db.exec("update public.user_settings set theme='dark'; update public.profiles set display_name='Updated after import'");
  await db.exec(sql);
  assert.equal((await db.query('select theme from public.user_settings')).rows[0].theme,'dark');
  assert.equal((await db.query('select display_name from public.profiles')).rows[0].display_name,'Updated after import');
 }
 console.log('PASS: legacy replay, original migrations, profile preservation, FK identities, single active trigger, archive isolation'+(process.argv[3]?', generic import and retry preservation.':'.'));
} finally { await db.close(); }
