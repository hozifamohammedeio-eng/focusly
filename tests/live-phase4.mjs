// Opt-in tests against the connected project. Never log credentials or tokens.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID,randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
if(!process.argv.includes('--run-live'))throw Error('Explicit --run-live required');
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.equal(new URL(url).hostname,'lxlpnynpatnsfvvvxwwx.supabase.co');
const path='.supabase/phase4-test-accounts.json',setup=process.argv.includes('--setup');
const saved=setup?{runId:randomUUID(),users:[]}:JSON.parse(await readFile(path,'utf8'));
const clients=[],checks=[];
const ok=(value,label)=>{assert.ok(value,label);checks.push(label);};
const value=(r,label)=>{assert.ifError(r.error);checks.push(label);return r.data;};
try{
 for(let i=0;i<2;i++){
  const c=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});clients.push(c);
  if(setup){const email=`focusly-p4-${saved.runId.slice(0,8)}-${i}@example.com`,password=randomBytes(32).toString('base64url')+'Aa1!';
   const r=value(await c.auth.signUp({email,password,options:{data:{display_name:'Phase 4 Test '+(i+1),focusly_test_run:saved.runId}}}),'Register '+i);
   ok(!!r.session,'Email/password session '+i);saved.users.push({id:r.user.id,email,password});await mkdir('.supabase',{recursive:true});await writeFile(path,JSON.stringify(saved));
   for(const [p_step,p_value] of [[1,{name:'Phase 4 Test '+(i+1)}],[2,{stage:'secondary'}],[3,{year:'secondary_2'}],[4,{minutes:60}],[5,{subjects:['Mathematics','Arabic']}]])value(await c.rpc('save_onboarding_step',{p_step,p_value}),'Onboarding '+i+' step '+p_step);
   value(await c.rpc('complete_onboarding',{p_locale:'en',p_theme:'light',p_accent:'violet'}),'Complete onboarding '+i);
   value(await c.from('user_settings').update({focus_minutes:5,short_break_minutes:1,long_break_minutes:2,time_zone:'Africa/Cairo'}).eq('user_id',r.user.id),'Set real timer preferences '+i);
   const subjects=value(await c.from('subjects').select('id,name'),'Read subjects '+i),math=subjects.find(s=>s.name==='Mathematics');
   value(await c.from('tasks').insert({user_id:r.user.id,subject_id:math.id,title:'Read one page with attention'}),'Create optional task '+i);
  }else value(await c.auth.signInWithPassword(saved.users[i]),'Login again '+i);
 }
 if(!setup){const [a,b]=clients;
  const sessions=value(await a.from('focus_sessions').select('*').eq('completed',true),'Read completed history');
  ok(sessions.length>=1,'Real timer persisted a completed session');
  const natural=sessions.find(s=>s.duration_seconds===300);ok(!!natural,'Natural five-minute session stores exactly 300 seconds');
  const retry=value(await a.rpc('focus_transition',{p_action:'finish',p_id:natural.id}),'Retry completion');ok(retry.session.duration_seconds===300,'Retry preserves recorded time');
  ok(value(await a.from('focus_sessions').select('id').eq('id',natural.id),'Read idempotent row').length===1,'Exactly one row for the completed timer');
  const p=value(await a.rpc('focus_progress'),'Read real progress');ok(p.totalSeconds===sessions.reduce((n,s)=>n+s.duration_seconds,0),'Total equals persisted valid focus seconds');ok(p.streak===1,'Today-only live history creates one-day streak');ok(p.days.reduce((n,d)=>n+d.seconds,0)===p.totalSeconds,'Weekly chart matches completed time');ok(p.subjects.reduce((n,s)=>n+s.seconds,0)===p.totalSeconds,'Subject totals match completed time');
  ok(value(await b.from('focus_sessions').select('*').eq('user_id',saved.users[0].id),'Cross-user read').length===0,'Other user cannot read sessions');
  ok(value(await b.from('focus_sessions').update({duration_seconds:301}).eq('id',natural.id).select(),'Cross-user update').length===0,'Other user cannot modify session');
  ok(value(await b.rpc('focus_progress'),'Other-user statistics').totalSeconds===0,'Statistics do not expose another user');
  const foreignSubject=value(await a.from('subjects').select('id').limit(1),'Own subject')[0].id,foreignTask=value(await a.from('tasks').select('id').limit(1),'Own task')[0].id;
  for(const [kind,id] of [['subject',foreignSubject],['task',foreignTask]]){
    const r=await b.rpc('focus_transition',{p_action:'start',p_id:randomUUID(),['p_'+kind]:id});ok(!!r.error,'RPC rejects foreign '+kind);
    const direct=await b.from('focus_sessions').insert({user_id:saved.users[1].id,[kind+'_id']:id,started_at:new Date().toISOString()});ok(direct.error?.code==='23503','Database rejects foreign '+kind+' reference');
  }
  if(natural.task_id){const task=value(await a.from('tasks').select('status').eq('id',natural.task_id),'Linked task state');ok(!task.length||task[0].status!=='completed','Focus completion does not complete task');}
  await a.auth.signOut({scope:'local'});value(await a.auth.signInWithPassword(saved.users[0]),'Logout and login');ok(value(await a.rpc('focus_progress'),'Statistics after login').totalSeconds===p.totalSeconds,'Statistics persist across login');
 }
 await writeFile(`../outputs/Focusly-Phase-4-${setup?'Setup':'Live-Tests'}.json`,JSON.stringify({status:'passed',runId:saved.runId,testUserIds:saved.users.map(u=>u.id),checks},null,2));console.log(checks.length+' live checks passed.');
}finally{for(const c of clients)await c.auth.signOut({scope:'local'});}
