import assert from "node:assert/strict";
import { test } from "node:test";
import { dateAdd, toInstant, type Block } from "../src/features/planning/logic.ts";
import { hasWorkload, parsePlan, validateInput, validatePlan, type GeneratedPlan, type PlannerInput } from "../src/features/ai-planner/model.ts";
import { aiPlannerCopy } from "../src/features/i18n/ai-planner.ts";

const subject = "97000000-0000-4000-8000-000000000001";
const first = "2026-10-03";
const input: PlannerInput = {
  weekStart: first, zone: "UTC", locale: "en", workload: { [subject]: "One lecture and a worksheet" }, backlog: "", exams: "",
  fixed: [{ id: "fixed-1", subjectId: subject, title: "Class", date: first, start: "10:00", end: "11:00", notes: "" }],
  dailyMinutes: 120, preferred: "afternoon", sessionMinutes: 45, daysOff: [], busyDays: [], prioritySubjects: [], style: "balanced",
};
const plan: GeneratedPlan = {
  items: [{ id: "item-1", subjectId: subject, title: "Lecture", type: "lecture", estimatedMinutes: 45, priority: "medium", isBacklog: false, deadline: null }],
  sessions: [{ id: "session-1", workItemId: "item-1", subjectId: subject, title: "Lecture", date: first, start: "12:00", end: "12:45", type: "lecture" }],
  summary: "One lecture", reasoning: ["After the fixed class"],
};
const ids = new Set([subject]);
const validate = (candidate: GeneratedPlan, changes: Partial<PlannerInput> = {}, existing: Block[] = []) =>
  validatePlan(candidate, { ...input, ...changes }, ids, existing);

test("bilingual copy contains every AI Planner label, with no English fallback in Arabic", () => {
  assert.deepEqual(Object.keys(aiPlannerCopy.en).sort(), Object.keys(aiPlannerCopy.ar).sort());
  assert.equal(aiPlannerCopy.en.cta, "AI Weekly Planner");
  assert.equal(aiPlannerCopy.ar.cta, "أنشئ جدولك بالذكاء الاصطناعي");
  assert.ok(Object.values(aiPlannerCopy.ar).every(value => !!value.trim()));
});
test("input requires a real owned subject and meaningful workload", () => {
  assert.equal(validateInput(input, ids), true);
  assert.equal(hasWorkload(input), true);
  assert.equal(hasWorkload({ ...input, workload: {}, fixed: [] }), false);
  assert.equal(validateInput({ ...input, workload: { other: "Work" } }, ids), false);
  assert.equal(validateInput({ ...input, weekStart: dateAdd(first, 1) }, ids), false);
});
test("provider output is parsed at runtime, not trusted by TypeScript", () => {
  assert.deepEqual(parsePlan(plan), plan);
  assert.equal(parsePlan({ ...plan, sessions: [{ ...plan.sessions[0], end: "tomorrow" }] }), null);
  assert.equal(parsePlan({ ...plan, items: [{ ...plan.items[0], priority: "urgent" }] }), null);
  assert.equal(parsePlan({ ...plan, reasoning: "because" }), null);
});
test("valid study slot respects fixed events and week bounds", () => {
  assert.equal(validate(plan).ok, true);
  assert.equal(validate({ ...plan, sessions: [{ ...plan.sessions[0]!, start: "10:30", end: "11:15" }] }).ok, false);
  assert.equal(validate({ ...plan, sessions: [{ ...plan.sessions[0]!, date: dateAdd(first, 7) }] }).ok, false);
});
test("hard constraints reject days off, foreign subjects, bad time, and daily overload", () => {
  assert.equal(validate(plan, { daysOff: [first] }).ok, false);
  assert.equal(validate({ ...plan, sessions: [{ ...plan.sessions[0]!, subjectId: "foreign" }] }).ok, false);
  assert.equal(validate({ ...plan, sessions: [{ ...plan.sessions[0]!, start: "25:00" }] }).ok, false);
  assert.equal(validate(plan, { dailyMinutes: 30 }).ok, false);
});
test("existing Planner entries and duplicate session IDs block a plan", () => {
  const block: Block = { id: subject, user_id: subject, subject_id: subject, task_id: null, title: "Existing", starts_at: "2026-10-03T12:15:00Z", ends_at: "2026-10-03T13:00:00Z", time_zone: "UTC", repeat_weekly: false, notes: null, created_at: "2026-10-03T00:00:00Z", updated_at: "2026-10-03T00:00:00Z" };
  assert.equal(validate(plan, {}, [block]).ok, false);
  assert.equal(validate({ ...plan, sessions: [{ ...plan.sessions[0]!, start: "14:00", end: "14:45" }] },
    { fixed: [{ ...input.fixed[0]!, start: "12:00", end: "12:30" }] }, [block]).ok, false);
  assert.equal(validate({ ...plan, sessions: [plan.sessions[0]!, plan.sessions[0]!] }).ok, false);
  assert.equal(validate({ ...plan, sessions: [{ ...plan.sessions[0]!, end: "12:20" }] }).ok, false);
});
test("an adjustment may move a flexible session while fixed commitment stays in input", () => {
  const moved: GeneratedPlan = { ...plan, sessions: [{ ...plan.sessions[0]!, date: dateAdd(first, 1), start: "16:00", end: "16:45" }] };
  assert.equal(validate(moved).ok, true);
  assert.deepEqual(input.fixed[0], { id: "fixed-1", subjectId: subject, title: "Class", date: first, start: "10:00", end: "11:00", notes: "" });
});
test("preview wall times resolve DST gaps and folds deterministically before save", () => {
  assert.equal(toInstant("2026-03-08", "02:30", "America/New_York"), null);
  assert.equal(toInstant("2026-11-01", "01:30", "America/New_York"), "2026-11-01T05:30:00.000Z");
});
