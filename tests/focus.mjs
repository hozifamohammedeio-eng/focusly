import test from "node:test";
import fs from "node:fs";
import ts from "typescript";
import assert from "node:assert/strict";

test("timer recovery preserves auth checks without invalidating the app layout", async () => {
  const source = fs.readFileSync(new URL("../src/features/focus/actions.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const invalidated = [];
  let authenticated = true, calls = 0, state = "running";
  const exports = {};
  new Function("require", "exports", code)((name) => {
    if (name === "next/cache") return { revalidatePath: (...args) => invalidated.push(args) };
    if (name === "@/lib/supabase/server") return { createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: authenticated ? { id: "fixture" } : null } }) },
      rpc: async () => { calls++; return { data: { session: { timer_state: state }, serverNow: new Date().toISOString() } }; },
    }) };
    if (name === "@/features/planning/logic") return { UUID: /^[0-9a-f-]{36}$/ };
    return {};
  }, exports);
  const f = new FormData(); f.set("action", "recover");
  await exports.focusAction(f);
  assert.equal(calls, 1); assert.deepEqual(invalidated, []);
  authenticated = false;
  assert.deepEqual(await exports.focusAction(f), { error: true }); assert.equal(calls, 1);
  authenticated = true; state = "completed";
  await exports.focusAction(f);
  assert.deepEqual(invalidated, [["/app"], ["/app/statistics"], ["/app/profile"], ["/app/challenges"], ["/app/city"], ["/app/achievements"]]);
});
test("Focus claim evaluates achievements only for a new trusted reward", async () => {
  const source = fs.readFileSync(new URL("../src/features/focus/actions.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const calls = [];
  let awarded = true;
  let fail = false;
  const exports = {};
  const prior = process.env.FOCUSLY2_REWARDS_ENABLED;
  process.env.FOCUSLY2_REWARDS_ENABLED = "true";
  try {
    new Function("require", "exports", code)((name) => {
      if (name === "next/cache") return { revalidatePath: () => {} };
      if (name === "@/lib/supabase/server") return { createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
        rpc: async (rpc) => {
          calls.push(rpc);
          if (rpc === "claim_focus_progression_reward" && fail) throw new Error("network");
          return rpc === "focus_transition"
            ? { data: { session: { id: "session", completed: true, timer_state: "completed" }, serverNow: new Date().toISOString() } }
            : { data: { awarded, achievements: awarded ? [{ achievementKey: "first_focus", reward: { xp: 1, coins: 0 } }] : [], challenges: awarded ? [{ eventId: "event" }] : [] } };
        },
      }) };
      if (name === "@/features/challenges/receipt") return { challengeAwardsFromClaim: (value) => value.awarded ? value.challenges : [] };
      if (name === "@/features/city/receipt") return { cityGrowthFromClaim: () => null };
      if (name === "@/features/progression/achievement-receipt") return { achievementAwardsFromEvaluation: (claim, value) => claim.awarded ? value : [] };
      if (name === "@/features/planning/logic") return { UUID: /^[0-9a-f-]{36}$/ };
      return {};
    }, exports);
    const form = new FormData(); form.set("action", "finish");
    const first = await exports.focusAction(form);
    assert.deepEqual(calls, ["focus_transition", "claim_focus_progression_reward"]);
    assert.equal(first.challengeAwards.length, 1);
    assert.equal(first.achievementAwards.length, 1);
    awarded = false;
    const replay = await exports.focusAction(form);
    assert.deepEqual(calls, ["focus_transition", "claim_focus_progression_reward", "focus_transition", "claim_focus_progression_reward"]);
    assert.deepEqual(replay.challengeAwards, []);
    assert.deepEqual(replay.achievementAwards, []);
    fail = true;
    const saved = await exports.focusAction(form);
    assert.equal(saved.session.completed, true);
    assert.deepEqual(saved.challengeAwards, []);
  } finally {
    if (prior === undefined) delete process.env.FOCUSLY2_REWARDS_ENABLED;
    else process.env.FOCUSLY2_REWARDS_ENABLED = prior;
  }
});
import {
  elapsedSeconds,
  remainingSeconds,
  stalePaused,
  timerDigits,
  formatDuration,
  groupSessions,
  currentStreak,
  weekDays,
  averageSeconds,
  todaySeconds,
  goalProgress,
} from "../src/features/focus/logic.ts";
const start = Date.parse("2026-09-15T10:00:00Z");
const s = {
  timer_state: "running",
  running_since: new Date(start).toISOString(),
  planned_seconds: 1500,
  accumulated_seconds: 0,
  duration_seconds: 0,
  updated_at: new Date(start).toISOString(),
};
test("timestamps recover after background throttling, cap sleep and exclude pauses", () => {
  assert.equal(remainingSeconds(s, start + 183000), 1317);
  assert.equal(elapsedSeconds(s, start + 99999999), 1500);
  const paused = {
    ...s,
    timer_state: "paused",
    running_since: null,
    accumulated_seconds: 183,
  };
  assert.equal(elapsedSeconds(paused, start + 900000), 183);
  const resumed = {
    ...paused,
    timer_state: "running",
    running_since: new Date(start + 900000).toISOString(),
  };
  assert.equal(elapsedSeconds(resumed, start + 917000), 200);
  assert.equal(stalePaused(paused, start + 8 * 86400000), true);
  assert.equal(stalePaused(s, start + 8 * 86400000), false);
  assert.equal(timerDigits(1500), "25:00");
  assert.equal(timerDigits(-1), "00:00");
});
test("format and goal use consistent real duration", () => {
  assert.equal(formatDuration(4800, "en"), "1 h 20 min");
  assert.equal(
    formatDuration(3600, "ar"),
    new Intl.NumberFormat("ar").format(1) + " س",
  );
  assert.equal(goalProgress(7200, 60).ratio, 2);
  assert.equal(goalProgress(7200, 60).remaining, 0);
});
test("calendar grouping, subject totals and streaks use local completion days", () => {
  const rows = [
    {
      completed: true,
      duration_seconds: 1500,
      ended_at: "2026-09-14T22:30:00Z",
      subject_id: "math",
    },
    {
      completed: true,
      duration_seconds: 600,
      ended_at: "2026-09-15T08:00:00Z",
      subject_id: null,
    },
    {
      completed: false,
      duration_seconds: 999,
      ended_at: "2026-09-15T08:00:00Z",
      subject_id: "math",
    },
    {
      completed: true,
      duration_seconds: 30,
      ended_at: "2026-09-15T08:00:00Z",
      subject_id: "math",
    },
  ];
  const g = groupSessions(rows, "Africa/Cairo");
  assert.equal(g.days.get("2026-09-15"), 2100);
  assert.equal(g.subjects.get("math"), 1500);
  assert.equal(g.subjects.get(null), 600);
  assert.equal(
    currentStreak(new Set(["2026-09-13", "2026-09-14"]), "2026-09-15"),
    2,
  );
  assert.equal(currentStreak(new Set(["2026-09-13"]), "2026-09-15"), 0);
  assert.equal(
    currentStreak(
      new Set(["2026-09-13", "2026-09-14", "2026-09-15"]),
      "2026-09-15",
    ),
    3,
  );
  const p = {
    weekStart: "2026-09-12",
    today: "2026-09-15",
    days: [{ day: "2026-09-15", seconds: 2100, sessions: 2 }],
  };
  assert.equal(weekDays(p).length, 7);
  assert.equal(weekDays(p)[0].seconds, 0);
  assert.equal(averageSeconds(p), 300);
  assert.equal(todaySeconds(p), 2100);
});
