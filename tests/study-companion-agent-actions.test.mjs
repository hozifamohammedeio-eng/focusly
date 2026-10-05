import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

const moduleCode = {
  "next/cache": `export const revalidatePath=()=>{};`,
  "./data": `export async function companionStudent(){return {user:{id:"97000000-0000-4000-8000-000000000001"},client:{from(){return {select(){return this},eq(){return this},update(value){globalThis.__profileUpdate=value;return this},async single(){return {data:{id:"97000000-0000-4000-8000-000000000001"},error:null}},async maybeSingle(){return {data:{companion_name:"Buddy",enabled:true,auto_greeting_enabled:true},error:null}}}}}}}`,
  "./provider": `export const companionProviderBusy=()=>false;`,
  "./agent-provider": `export async function interpretAgentMessage(){return globalThis.__decision;}`,
  "./tools/snapshot": `export async function loadAgentSnapshot(){return {today:"2026-10-04",now:"2026-10-04T10:00:00Z",zone:"Africa/Cairo",goal:globalThis.__snapshotGoal??120,tasks:[],subjects:[],blocks:globalThis.__blocks??[],schedule:[]}}
    export function dayEvents(){return {tasks:[],blocks:[],lessons:[]}}`,
  "./tools/execute": `export async function executeTool(call){
    globalThis.__executed=(globalThis.__executed??[]).concat(call.tool);
    if(globalThis.__failTool===call.tool)return {ok:false,message:"Could not complete the next step."};
    return {ok:true,message:"Done: "+call.tool};
  }`,
};
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier in moduleCode) return {url:`data:text/javascript,${encodeURIComponent(moduleCode[specifier])}`,shortCircuit:true};
  return nextResolve(specifier,context);
} });
const { agentMessage, confirmAgentCalls, undoAgentAction, chooseAgentCandidate } = await import("../src/features/study-companion/agent-actions.ts");
const request = "97000000-0000-4000-8000-000000000099";
const task = {tool:"create_task",args:{title:"Chemistry homework",day:"tomorrow"}};

test("explicit low-risk task command executes once without extra confirmation", async () => {
  globalThis.__executed=[];
  globalThis.__decision={message:"I'll check.",explicit:true,calls:[task]};
  const result=await agentMessage("Add Chemistry homework tomorrow","en",[],null,request);
  assert.equal(result.ok,true);assert.deepEqual(globalThis.__executed,["create_task"]);assert.equal(result.pending,undefined);
});
test("model-selected wrong-domain write cannot execute without confirmation", async () => {
  globalThis.__executed=[];
  globalThis.__decision={message:"I'll check.",explicit:true,calls:[{tool:"set_goal",args:{value:"120"}}]};
  const result=await agentMessage("Add Chemistry homework tomorrow","en",[],null,request);
  assert.equal(result.ok,true);assert.ok(result.pending);assert.deepEqual(globalThis.__executed,[]);
});
test("deletes and two-step requests remain pending until confirmed", async () => {
  globalThis.__executed=[];
  globalThis.__decision={message:"",explicit:true,calls:[{tool:"delete_task",args:{query:"Chemistry"}}]};
  const deletion=await agentMessage("Delete Chemistry task","en",[],null,request);
  assert.ok(deletion.ok && deletion.pending);assert.deepEqual(globalThis.__executed,[]);
  globalThis.__decision={message:"",explicit:true,calls:[task,{tool:"create_reminder",args:{title:"Chemistry",day:"tomorrow",time:"19:00"}}]};
  const multi=await agentMessage("Add Chemistry task and remind me tomorrow","en",[],null,request);
  assert.ok(multi.ok && multi.pending);assert.deepEqual(globalThis.__executed,[]);
  const applied=await confirmAgentCalls(multi.pending.calls,"en",null,request);
  assert.equal(applied.ok,true);assert.deepEqual(globalThis.__executed,["create_task","create_reminder"]);
});
test("partial multi-step failure reports completed first step honestly", async () => {
  globalThis.__executed=[];globalThis.__failTool="create_reminder";
  try {
    const result=await confirmAgentCalls([task,{tool:"create_reminder",args:{title:"Chemistry",day:"tomorrow",time:"19:00"}}],"en",null,request);
    assert.equal(result.ok,false);assert.match(result.text,/Done: create_task/);assert.match(result.text,/Could not complete/);
  } finally { globalThis.__failTool=undefined; }
});
test("read-only tomorrow question is deterministic and never invokes Gemini", async () => {
  globalThis.__executed=[];globalThis.__decision=null;
  const result=await agentMessage("what do I have tomorrow?","en",[],null,request);
  assert.equal(result.ok,true);assert.deepEqual(globalThis.__executed,["read_day"]);
});
test("fast goal update skips Gemini and keeps normal tool validation", async () => {
  globalThis.__executed=[];globalThis.__decision=null;
  const result=await agentMessage("غير هدفي لـ90 دقيقة","ar",[],null,request,{page:"settings",memory:{}});
  assert.equal(result.ok,true);assert.deepEqual(globalThis.__executed,["set_goal"]);
});
test("safe undo checks the immediately recorded state", async () => {
  globalThis.__profileUpdate=undefined;
  const undone=await undoAgentAction({kind:"goal",before:90,after:120},"en");
  assert.equal(undone.ok,true);assert.deepEqual(globalThis.__profileUpdate,{daily_goal_minutes:90});
  globalThis.__profileUpdate=undefined;
  const arabic=await agentMessage("رجعها زي الأول","ar",[],null,request,{page:"settings",memory:{undo:{kind:"goal",before:90,after:120}}});
  assert.equal(arabic.ok,true);assert.deepEqual(globalThis.__profileUpdate,{daily_goal_minutes:90});
  globalThis.__snapshotGoal=130;globalThis.__profileUpdate=undefined;
  try { const stale=await undoAgentAction({kind:"goal",before:90,after:120},"en");
    assert.equal(stale.ok,false);assert.equal(globalThis.__profileUpdate,undefined); }
  finally {globalThis.__snapshotGoal=undefined;}
});
test("Planner undo rechecks the exact current owned block before a reverse move", async () => {
  const id="97000000-0000-4000-8000-000000000007";
  const receipt={kind:"block",id,before:{title:"Physics",start:"2026-10-05T14:00:00Z",end:"2026-10-05T15:00:00Z"},
    after:{title:"Physics",start:"2026-10-05T16:00:00Z",end:"2026-10-05T17:00:00Z"}};
  globalThis.__blocks=[{id,title:"Physics",starts_at:receipt.after.start,ends_at:receipt.after.end}];
  globalThis.__executed=[];
  try {
    const valid=await undoAgentAction(receipt,"en");
    assert.equal(valid.ok,true);assert.deepEqual(globalThis.__executed,["move_block"]);
    globalThis.__blocks=[{id,title:"Physics",starts_at:"2026-10-05T17:00:00Z",ends_at:receipt.after.end}];
    globalThis.__executed=[];
    const stale=await undoAgentAction(receipt,"en");
    assert.equal(stale.ok,false);assert.deepEqual(globalThis.__executed,[]);
  } finally {globalThis.__blocks=undefined;}
});
test("candidate selection rechecks owned rows before executing", async () => {
  globalThis.__executed=[];
  const selected=await chooseAgentCandidate({tool:"complete_task",args:{query:"Physics"}},
    {kind:"task",id:"97000000-0000-4000-8000-000000000099",title:"Foreign"},"en",request);
  assert.equal(selected.ok,false);assert.deepEqual(globalThis.__executed,[]);
});
test("an AI answer without an executed call cannot claim a requested write succeeded", async () => {
  globalThis.__executed=[];
  globalThis.__decision={message:"Done, I deleted it.",explicit:true,calls:[]};
  const result=await agentMessage("Delete my Physics task","en",[],null,request);
  assert.equal(result.ok,true);assert.doesNotMatch(result.text,/deleted|done/i);assert.deepEqual(globalThis.__executed,[]);
});
