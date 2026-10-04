import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

const moduleCode = {
  "next/cache": `export const revalidatePath=()=>{};`,
  "./data": `export async function companionStudent(){return {user:{id:"97000000-0000-4000-8000-000000000001"},client:{from(){return {select(){return this},eq(){return this},async maybeSingle(){return {data:{companion_name:"Buddy",enabled:true,auto_greeting_enabled:true},error:null}}}}}}}`,
  "./provider": `export const companionProviderBusy=()=>false;`,
  "./agent-provider": `export async function interpretAgentMessage(){return globalThis.__decision;}`,
  "./tools/snapshot": `export async function loadAgentSnapshot(){return {today:"2026-10-04",now:"2026-10-04T10:00:00Z",zone:"Africa/Cairo",tasks:[],subjects:[],blocks:[],schedule:[]}}
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
const { agentMessage, confirmAgentCalls } = await import("../src/features/study-companion/agent-actions.ts");
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
