import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
  if (specifier === "next/cache") return { url: "data:text/javascript,export const revalidatePath=()=>{}", shortCircuit: true };
  if (specifier === "@/features/planning/actions") return { url: `data:text/javascript,${encodeURIComponent(`
    export async function mutate(form) { globalThis.__agentForm = Object.fromEntries(form); return globalThis.__agentMutation ?? {success:"saved"}; }
  `)}`, shortCircuit: true };
  if (specifier === "../actions") return { url: `data:text/javascript,${encodeURIComponent(`
    export async function createStudyReminder(value) { globalThis.__agentReminder = value; return {ok:true,value:{id:value.requestId,alreadySaved:false}}; }
    export async function saveCompanionName(value) { return {ok:true,value:{name:value}}; }
    export async function saveCompanionPreferences(enabled, autoGreetingEnabled) { return {ok:true,value:{enabled,autoGreetingEnabled}}; }
  `)}`, shortCircuit: true };
  return nextResolve(specifier, context);
} });
const { executeTool } = await import("../src/features/study-companion/tools/execute.ts");
const owner = "97000000-0000-4000-8000-000000000001";
const request = "97000000-0000-4000-8000-000000000099";
const task = { id: owner, title: "Physics homework", day: "2026-10-05", subjectId: null, priority: "medium", notes: null, status: "todo", dueAt: null };
const snapshot = { owner, today: "2026-10-04", now: "2026-10-04T10:00:00Z", zone: "Africa/Cairo", goal: 120,
  locale: "en", theme: "light", accent: "violet", tasks: [task], subjects: [], blocks: [], schedule: [], reminders: [] };
function fakeStudent() {
  const recorded = [];
  const client = { from(table) {
    const query = { select() { return this; }, eq() { return this; }, order() { return this; },
      range: async () => ({data:[],error:null}), update(value) { recorded.push({table,kind:"update",value}); return this; },
      insert(value) { recorded.push({table,kind:"insert",value}); return this; },
      maybeSingle: async () => ({ data: null, error: null }),
      single: async () => ({ data: {id: owner}, error: null }),
      then(resolve) { resolve({data: [],error:null}); },
    };
    return query;
  } };
  return { student: { user: {id:owner}, client }, recorded };
}
test("explicit task creation derives owner and stable request-scoped ID", async () => {
  const {student,recorded} = fakeStudent();
  const call = {tool:"create_task",args:{title:"Solve 20 Chemistry questions",day:"tomorrow"}};
  const result = await executeTool(call,snapshot,student,"en",null,request,0);
  assert.equal(result.ok,true);
  assert.equal(recorded[0].value.user_id,owner);
  assert.equal(recorded[0].value.task_date,"2026-10-05");
  assert.match(recorded[0].value.id,/^[0-9a-f-]{36}$/);
  assert.doesNotMatch(result.message,/database|id:/i);
});
test("task creation with no day asks instead of silently using today", async () => {
  const {student,recorded} = fakeStudent();
  const result = await executeTool({tool:"create_task",args:{title:"Chemistry homework"}},snapshot,student,"en",null,request,0);
  assert.equal(result.ok,false); assert.equal(recorded.length,0);
});
test("task completion uses existing trusted mutation, not a fake reward write", async () => {
  const {student} = fakeStudent();
  const result = await executeTool({tool:"complete_task",args:{query:"Physics",day:"tomorrow"}},snapshot,student,"ar",null,request,0);
  assert.equal(result.ok,true);
  assert.equal(globalThis.__agentForm.entity,"tasks");
  assert.equal(globalThis.__agentForm.action,"complete");
  assert.equal(globalThis.__agentForm.completed,"true");
  assert.match(result.message,/خلصت/);
});
test("failed task completion never claims success", async () => {
  const {student} = fakeStudent();
  globalThis.__agentMutation = {error:"saveError"};
  try {
    const result = await executeTool({tool:"complete_task",args:{query:"Physics"}},snapshot,student,"en",null,request,0);
    assert.equal(result.ok,false); assert.match(result.message,/couldn't change/);
  } finally { globalThis.__agentMutation = undefined; }
});
test("daily goal update is owner-scoped and range-checked", async () => {
  const {student,recorded} = fakeStudent();
  assert.equal((await executeTool({tool:"set_goal",args:{value:"120"}},snapshot,student,"en",null,request,0)).ok,true);
  assert.equal(recorded[0].value.daily_goal_minutes,120);
  assert.equal((await executeTool({tool:"set_goal",args:{value:"900"}},snapshot,student,"en",null,request,0)).ok,false);
});
test("reminder creation reuses validated proposal and V1 idempotent saver", async () => {
  const {student} = fakeStudent();
  const future = new Date(Date.now()+86400000);
  const day = new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Cairo",year:"numeric",month:"2-digit",day:"2-digit"}).format(future);
  const current = {...snapshot,today:day,now:new Date().toISOString()};
  const result = await executeTool({tool:"create_reminder",args:{title:"Programming",day, time:"19:00"}},current,student,"en",null,request,0);
  assert.equal(result.ok,true);
  assert.equal(globalThis.__agentReminder.zone,"Africa/Cairo");
  assert.equal(globalThis.__agentReminder.title,"Programming");
});
test("ambiguous task never mutates and asks for clarification", async () => {
  const {student} = fakeStudent();
  const current = {...snapshot,tasks:[task,{...task,id:"97000000-0000-4000-8000-000000000002"}]};
  globalThis.__agentForm = null;
  const result = await executeTool({tool:"complete_task",args:{query:"Physics"}},current,student,"en",null,request,0);
  assert.equal(result.ok,false); assert.equal(result.ambiguous,true); assert.equal(globalThis.__agentForm,null);
});
test("planner move resolves the owned block and delegates to existing overlap-aware mutation", async () => {
  const {student} = fakeStudent();
  const current = {...snapshot, subjects:[{id:"97000000-0000-4000-8000-000000000010",name:"Physics",color:"#6558d3",archived:false}],
    blocks:[{id:"97000000-0000-4000-8000-000000000011",user_id:owner,title:"Physics study",subject_id:"97000000-0000-4000-8000-000000000010",
      task_id:null,starts_at:"2026-10-05T14:00:00Z",ends_at:"2026-10-05T15:00:00Z",repeat_weekly:false,time_zone:"Africa/Cairo",
      notes:null,created_at:"2026-10-04T00:00:00Z",updated_at:"2026-10-04T00:00:00Z"}]};
  const result = await executeTool({tool:"move_block",args:{query:"Physics",fromDay:"tomorrow",fromTime:"17:00",day:"tomorrow",time:"19:00"}},
    current,student,"en",null,request,0);
  assert.equal(result.ok,true);
  assert.equal(globalThis.__agentForm.entity,"study_blocks");
  assert.equal(globalThis.__agentForm.id,current.blocks[0].id);
  assert.equal(globalThis.__agentForm.time,"19:00");
});
test("block creation is request-id stable and owner-scoped", async () => {
  const {student,recorded} = fakeStudent();
  const current = {...snapshot,subjects:[{id:"97000000-0000-4000-8000-000000000010",name:"Physics",color:"#6558d3",archived:false}]};
  const call = {tool:"create_block",args:{title:"Physics study",subject:"Physics",day:"tomorrow",time:"19:00",duration:25}};
  const first = await executeTool(call,current,student,"en",null,request,0);
  assert.equal(first.ok,true);
  assert.equal(recorded[0].table,"study_blocks");
  assert.equal(recorded[0].value.user_id,owner);
  const {student:second,recorded:again} = fakeStudent();
  assert.equal((await executeTool(call,current,second,"en",null,request,0)).ok,true);
  assert.equal(again[0].value.id,recorded[0].value.id);
});
