// Explicit opt-in: creates two real, temporary Auth accounts; never logs credentials.
// node --env-file=.env.local tests/live-reconciliation.mjs --run-live
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
if (!process.argv.includes('--run-live')) throw new Error('Explicit --run-live required');
const url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.equal(new URL(url).hostname,'lxlpnynpatnsfvvvxwwx.supabase.co');
const report={startedAt:new Date().toISOString(),checks:[],testUserIds:[],limitations:['Existing account password unavailable; its login was not attempted.','Auth/API and server-rendered routes tested; this script does not simulate browser form clicks.']};
const clients=[];
const check=(value,label)=>{assert.ok(value,label);report.checks.push(label);};
const ok=(result,label)=>{if(result.error) throw new Error(label+': '+result.error.code);report.checks.push(label);return result.data;};
function ssr(jar) {return createServerClient(url,key,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(({name,value})=>value?jar.set(name,value):jar.delete(name))}});}
async function route(path,jar){const r=await fetch('http://localhost:3000'+path,{redirect:'manual',headers:{cookie:[...jar].map(([n,v])=>n+'='+v).join('; ')}});const html=await r.text();return {status:r.status,redirect:r.headers.get('location')||html.match(/NEXT_REDIRECT;replace;([^;]+);/)?.[1],html};}
try {
 for(let i=0;i<2;i++) {
  const jar=new Map(), client=ssr(jar), password=randomBytes(30).toString('base64url')+'Aa1!';
  const email='focusly-reconciliation-'+randomUUID()+'@example.com';
  clients.push({client,jar,password,email});
  const data=ok(await client.auth.signUp({email,password,options:{data:{display_name:'Reconciliation Test '+(i+1)}}}),'Live signup '+(i+1));
  check(!!data.session,'Signup returned a real session '+(i+1));
  clients[i].id=data.user.id;report.testUserIds.push(data.user.id);
  const p=ok(await client.from('profiles').select('*').single(),'Provisioned private profile '+(i+1));
  check(p.display_name==='Reconciliation Test '+(i+1),'Provisioned display name '+(i+1));
  ok(await client.from('user_settings').select('*').single(),'Provisioned settings '+(i+1));
  ok(await client.auth.signOut(),'Initial logout '+(i+1));
  ok(await client.auth.signInWithPassword({email,password}),'Password login '+(i+1));
 }
 const [a,b]=clients;
 check((await route('/app',a.jar)).redirect==='/onboarding','Incomplete authenticated user redirects to onboarding');
 check((await route('/onboarding',a.jar)).status===200,'Onboarding route renders with real session');
 const fresh=ssr(a.jar);
 check(ok(await fresh.auth.getUser(),'Session verified from a new SSR client').user.id===a.id,'Cookie session persists across server clients');
 const early=await a.client.rpc('complete_onboarding',{p_locale:'ar',p_theme:'dark',p_accent:'green'});
 check(early.error?.code==='22023','Incomplete onboarding cannot complete through RPC');
 for(const [p_step,p_value] of [[1,{name:'اختبار Focusly'}],[2,{stage:'secondary'}],[3,{year:'secondary_2'}],[4,{minutes:150}],[5,{subjects:['الرياضيات','English',' English ']}]]) ok(await a.client.rpc('save_onboarding_step',{p_step,p_value}),'Persisted onboarding step '+p_step);
 const draft=ok(await fresh.from('profiles').select('*').single(),'Reloaded persisted draft');
 check(draft.school_stage==='secondary'&&draft.school_year==='secondary_2'&&draft.daily_goal_minutes===150&&!draft.onboarding_completed,'Stage, exact year and daily goal persist before completion');
 const completion={p_locale:'ar',p_theme:'dark',p_accent:'green'};
 const completed=await Promise.all([a.client.rpc('complete_onboarding',completion),a.client.rpc('complete_onboarding',completion)]);
 for(const r of completed)ok(r,'Concurrent completion succeeded');
 const subjects=ok(await a.client.from('subjects').select('*'),'Read completed subjects');
 check(subjects.length===2,'Concurrent completion creates selected subjects exactly once');
 check(ok(await a.client.from('profiles').select('*').single(),'Reloaded completed profile').onboarding_completed,'Completion flag persists after successful completion');
 const prefs=ok(await fresh.from('user_settings').select('*').single(),'Reloaded appearance preferences');
 check(prefs.locale==='ar'&&prefs.theme==='dark'&&prefs.accent==='green','Appearance preferences persist');
 check(!(await route('/app',a.jar)).redirect,'Completed user can enter app');
 check((await route('/onboarding',a.jar)).redirect==='/app','Completed user is redirected from onboarding to app');
 check((await route('/login',a.jar)).redirect==='/app','Completed user is redirected from login to app');
 const subject=subjects[0].id;
 const task=ok(await a.client.from('tasks').insert({user_id:a.id,subject_id:subject,title:'Isolation test'}).select().single(),'Own task insert');
 const block=ok(await a.client.from('study_blocks').insert({user_id:a.id,subject_id:subject,title:'Isolation test',starts_at:new Date().toISOString(),ends_at:new Date(Date.now()+3600000).toISOString()}).select().single(),'Own block insert');
 const session=ok(await a.client.from('focus_sessions').insert({user_id:a.id,subject_id:subject,task_id:task.id,started_at:new Date().toISOString()}).select().single(),'Own focus session insert');
 const tables=['profiles','user_settings','subjects','tasks','study_blocks','focus_sessions'];
 for(const table of tables) {
  const owner=table==='profiles'?'id':'user_id';
  check(ok(await b.client.from(table).select('*').eq(owner,a.id),table+': cross-user SELECT response').length===0,table+': cross-user reads hidden');
  check(ok(await b.client.from(table).update({updated_at:new Date().toISOString()}).eq(owner,a.id).select(),table+': cross-user UPDATE response').length===0,table+': cross-user updates denied');
  check(ok(await b.client.from(table).delete().eq(owner,a.id).select(),table+': cross-user DELETE response').length===0,table+': cross-user deletes denied');
  const updated=ok(await a.client.from(table).update({updated_at:new Date().toISOString()}).eq(owner,a.id).select(),table+': own update');
  check(updated.length>0,table+': own update affects rows');
  check((await a.client.from(table).update({[owner]:b.id}).eq(owner,a.id)).error?.code==='42501',table+': WITH CHECK prevents owner reassignment');
 }
 const forged={profiles:{id:a.id},user_settings:{user_id:a.id},subjects:{user_id:a.id,name:'Forbidden'},tasks:{user_id:a.id,title:'Forbidden'},study_blocks:{user_id:a.id,title:'Forbidden',starts_at:new Date().toISOString(),ends_at:new Date(Date.now()+60000).toISOString()},focus_sessions:{user_id:a.id,started_at:new Date().toISOString()}};
 for(const [table,row]of Object.entries(forged))check((await b.client.from(table).insert(row)).error?.code==='42501',table+': INSERT WITH CHECK rejects forged ownership');
 const foreign=[['tasks',{user_id:b.id,subject_id:subject,title:'Forbidden'}],['study_blocks',{user_id:b.id,subject_id:subject,title:'Forbidden',starts_at:new Date().toISOString(),ends_at:new Date(Date.now()+60000).toISOString()}],['focus_sessions',{user_id:b.id,subject_id:subject,started_at:new Date().toISOString()}],['focus_sessions',{user_id:b.id,task_id:task.id,started_at:new Date().toISOString()}]];
 for(const [table,row]of foreign)check((await b.client.from(table).insert(row)).error?.code==='23503',table+': cross-owner foreign key rejected');
 const anonymous=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 for(const table of tables)check((await anonymous.from(table).select('*')).error?.code==='42501',table+': anonymous reads denied');
 check((await anonymous.rpc('complete_onboarding',completion)).error?.code==='42501','Anonymous onboarding RPC denied');
 for(const table of ['user_preferences','study_sessions','planner_items','prayer_preferences','prayer_logs','push_subscriptions','reminders','ai_usage'])check((await a.client.from(table).select('*')).error?.code==='42501',table+': legacy Data API access denied');
 // Delete only disposable validation rows, never an existing user's data.
 for(const [table,id]of [['focus_sessions',session.id],['study_blocks',block.id],['tasks',task.id]])check(ok(await a.client.from(table).delete().eq('id',id).select(),table+': own DELETE').length===1,table+': own DELETE affected test row');
 ok(await a.client.auth.signOut(),'Live logout after onboarding');
 check(!ok(await a.client.auth.getSession(),'Read signed-out session').session,'Logout clears persisted session');
 check((await route('/app',a.jar)).redirect==='/login','App protected after logout');
 check((await route('/onboarding',new Map())).redirect==='/login','Onboarding protected without login');
 ok(await a.client.auth.signInWithPassword({email:a.email,password:a.password}),'Password login again');
 check(!(await route('/app',a.jar)).redirect,'Completed account enters app after login again');
 check(ok(await a.client.from('subjects').select('*'),'Subjects after repeat login').length===2,'Subjects persist without duplicates after repeat login');
 report.status='passed';
} catch(error) {report.status='failed';report.failure=error.message;process.exitCode=1;}
finally {
 for(const {client} of clients)await client.auth.signOut();
 report.finishedAt=new Date().toISOString();report.testAccounts='Retained for audit; signed out. Random passwords and tokens were kept only in memory and are not exported.';
 await writeFile(new URL('../../outputs/Focusly-Live-Reconciliation-Tests.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:report.status,checks:report.checks.length,failure:report.failure}));
}
