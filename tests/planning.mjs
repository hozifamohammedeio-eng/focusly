import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import {
  validSubject,
  validTask,
  validDate,
  toInstant,
  occurrences,
  overlaps,
  filterTasks,
  taskDay,
  dayInZone,
  dateAdd,
  weekStart,
  formatRange,
  formatDay,
} from "../src/features/planning/logic.ts";
import { phase3 } from "../src/features/i18n/phase3.ts";
test("daily task copy and dates work in English and Arabic", () => {
  assert.equal(phase3.en.noToday, "No tasks for today yet.");
  assert.equal(phase3.ar.noToday, "لا توجد مهام لليوم بعد.");
  assert.notEqual(formatDay("2026-10-01", "en", { dateStyle: "full" }),
    formatDay("2026-10-01", "ar", { dateStyle: "full" }));
});
test("Task completion evaluates achievements only for a new trusted reward", async () => {
  const source = fs.readFileSync(new URL("../src/features/planning/actions.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const rpcCalls = [];
  let awarded = true;
  let fail = false;
  const chain = { update: () => chain, select: () => chain, eq: () => chain, single: async () => ({ data: { id: "task" }, error: null }) };
  const exports = {};
  const prior = process.env.FOCUSLY2_REWARDS_ENABLED;
  process.env.FOCUSLY2_REWARDS_ENABLED = "true";
  try {
    new Function("require", "exports", code)((name) => {
      if (name === "next/cache") return { revalidatePath: () => {} };
      if (name === "@/lib/supabase/server") return { createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
        from: (table) => table === "profiles"
          ? { select: () => ({ eq: () => ({ single: async () => ({ data: { onboarding_completed: true } }) }) }) }
          : chain,
        rpc: async (rpc) => { rpcCalls.push(rpc); if (fail) throw new Error("network"); return rpc === "evaluate_progression_achievements" ? { data: [{ achievementKey: "first_task" }] } : { data: { awarded, challenges: awarded ? [{ eventId: "event" }] : [] } }; },
      }) };
      if (name === "@/features/challenges/receipt") return { challengeAwardsFromClaim: (value) => value.awarded ? value.challenges : [] };
      if (name === "@/features/city/receipt") return { cityGrowthFromClaim: () => null };
      if (name === "@/features/progression/achievement-receipt") return { achievementAwardsFromEvaluation: (claim, value) => claim.awarded ? value : [] };
      if (name === "./logic") return { UUID: /^[a-z]+$/ };
      return {};
    }, exports);
    const form = new FormData();
    form.set("entity", "tasks"); form.set("action", "complete"); form.set("id", "task"); form.set("completed", "true");
    const first = await exports.mutate(form);
    assert.deepEqual(rpcCalls, ["claim_task_progression_reward", "evaluate_progression_achievements"]);
    assert.equal(first.challengeAwards.length, 1);
    assert.equal(first.achievementAwards.length, 1);
    awarded = false;
    const replay = await exports.mutate(form);
    assert.deepEqual(rpcCalls, ["claim_task_progression_reward", "evaluate_progression_achievements", "claim_task_progression_reward"]);
    assert.deepEqual(replay.challengeAwards, []);
    assert.deepEqual(replay.achievementAwards, []);
    fail = true;
    const saved = await exports.mutate(form);
    assert.equal(saved.success, "saved");
    assert.deepEqual(saved.challengeAwards, []);
    fail = false;
    form.set("completed", "false");
    await exports.mutate(form);
    assert.equal(rpcCalls.length, 4);
    process.env.FOCUSLY2_REWARDS_ENABLED = "false";
    form.set("completed", "true");
    const disabled = await exports.mutate(form);
    assert.equal(rpcCalls.length, 4);
    assert.deepEqual(disabled.challengeAwards, []);
  } finally {
    if (prior === undefined) delete process.env.FOCUSLY2_REWARDS_ENABLED;
    else process.env.FOCUSLY2_REWARDS_ENABLED = prior;
  }
});
test("planner date ranges use stable spaces across server/browser ICU versions", () => {
  assert.equal(formatRange("2026-09-19", "2026-09-25", "en"), "Sep 19 – 25, 2026");
  for (const locale of ["en", "ar"]) {
    assert.doesNotMatch(formatRange("2026-09-19", "2026-09-25", locale), /[\u00a0\u2009\u202f]/);
  }
});
const task = (id, fields = {}) => ({
  id,
  title: id,
  notes: null,
  user_id: "a",
  subject_id: null,
  priority: "medium",
  status: "todo",
  due_at: null,
  due_on: null,
  task_date: "2026-01-01",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  completed_at: null,
  estimated_minutes: null,
  ...fields,
});
const block = (id, fields = {}) => ({
  id,
  user_id: "a",
  subject_id: "s",
  title: "Study",
  notes: null,
  starts_at: "2026-03-01T14:00:00Z",
  ends_at: "2026-03-01T15:00:00Z",
  repeat_weekly: true,
  time_zone: "America/New_York",
  created_at: "",
  updated_at: "",
  ...fields,
});
test("subject and task validation enforce meaningful limits and exclusive deadline types", () => {
  assert.ok(validSubject("  اللغة العربية  ", "#6558d3"));
  assert.ok(!validSubject("   ", "#ffffff"));
  assert.ok(!validSubject("x".repeat(81), "#ffffff"));
  assert.ok(!validSubject("Name", "#xxzz11"));
  assert.ok(!validSubject("Bad\u0000Name", "#ffffff"));
  assert.ok(validTask({ ...task("valid"), notes: "" }));
  assert.ok(!validTask({ ...task(""), notes: "" }));
  assert.ok(!validTask({ ...task("x", { priority: "urgent" }), notes: "" }));
  assert.ok(!validTask({ ...task("x", { due_on: "2026-02-30" }), notes: "" }));
  assert.ok(
    !validTask({
      ...task("x", { due_on: "2026-01-01", due_at: "2026-01-01T12:00:00Z" }),
      notes: "",
    }),
  );
});
test("canonical task day stays fixed across zone changes and DST", () => {
  const only = task("a", { due_on: "2026-09-14", task_date: "2026-09-14" }),
    timed = task("b", { due_at: "2026-09-14T00:30:00Z", task_date: "2026-09-14" });
  for (const zone of [
    "America/Los_Angeles",
    "Pacific/Kiritimati",
    "Africa/Cairo",
  ])
    assert.equal(taskDay(only, zone), "2026-09-14");
  assert.equal(taskDay(timed, "America/Los_Angeles"), "2026-09-14");
  assert.equal(dayInZone("2026-10-01T21:30:00Z", "Africa/Cairo"), "2026-10-02");
  assert.equal(dayInZone("2026-10-01T21:30:00Z", "America/New_York"), "2026-10-01");
  assert.equal(dayInZone("2026-03-08T06:59:00Z", "America/New_York"), "2026-03-08");
  assert.equal(validDate("2024-02-29"), true);
  assert.equal(validDate("2026-02-29"), false);
  assert.equal(dateAdd("2026-12-31", 1), "2027-01-01");
  assert.equal(weekStart("2026-09-14"), "2026-09-12");
});
test("Today, Upcoming and compound filters exclude completed tasks and sorting is stable", () => {
  const rows = [
    task("undated", { task_date: "2026-09-16" }),
    task("done", { due_on: "2026-09-10", task_date: "2026-09-10", status: "completed" }),
    task("tomorrow", {
      due_on: "2026-09-15",
      task_date: "2026-09-15",
      priority: "high",
      subject_id: "math",
    }),
    task("today", { due_on: "2026-09-14", task_date: "2026-09-14" }),
    task("late", { due_on: "2026-09-13", task_date: "2026-09-13" }),
  ];
  assert.deepEqual(
    filterTasks(rows, "today", "", "", "2026-09-14", "UTC").map((x) => x.id),
    ["today"],
  );
  assert.deepEqual(
    filterTasks(rows, "upcoming", "math", "high", "2026-09-14", "UTC").map(
      (x) => x.id,
    ),
    ["tomorrow"],
  );
  assert.deepEqual(
    filterTasks(rows, "all", "", "", "2026-09-14", "UTC").map((x) => x.id),
    ["late", "today", "tomorrow", "undated", "done"],
  );
  assert.deepEqual(
    filterTasks([task("b"), task("a")], "all", "", "", "2026-09-14", "UTC").map(
      (x) => x.id,
    ),
    ["a", "b"],
  );
});
test("weekly recurrence holds wall time across DST, has no pre-anchor occurrence, and handles gaps explicitly", () => {
  const b = block("weekly");
  const list = occurrences([b], "2026-02-28", "2026-03-15", "UTC");
  assert.deepEqual(
    list.map((x) => x.starts),
    [
      "2026-03-01T14:00:00.000Z",
      "2026-03-08T13:00:00.000Z",
      "2026-03-15T13:00:00.000Z",
    ],
  );
  assert.equal(toInstant("2026-03-08", "02:30", "America/New_York"), null);
  assert.equal(
    toInstant("2026-11-01", "01:30", "America/New_York"),
    "2026-11-01T05:30:00.000Z",
  );
  assert.equal(toInstant("2026-03-01", "09:00", "Invalid/Zone"), null);
});
test("overlap detection distinguishes touching boundaries and detects distant weekly conflicts", () => {
  const weekly = block("weekly");
  assert.ok(
    overlaps(
      block("single", {
        repeat_weekly: false,
        starts_at: "2026-03-08T13:30:00Z",
        ends_at: "2026-03-08T14:30:00Z",
      }),
      [weekly],
    ),
  );
  assert.ok(
    !overlaps(
      block("single", {
        repeat_weekly: false,
        starts_at: "2026-03-08T14:00:00Z",
        ends_at: "2026-03-08T15:00:00Z",
      }),
      [weekly],
    ),
  );
  assert.ok(!overlaps(weekly, [weekly]));
  assert.ok(
    overlaps(
      block("future", {
        starts_at: "2028-03-05T14:30:00Z",
        ends_at: "2028-03-05T15:30:00Z",
      }),
      [weekly],
    ),
  );
});
