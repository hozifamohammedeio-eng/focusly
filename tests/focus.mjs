import test from "node:test";
import assert from "node:assert/strict";
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
