import test from "node:test";
import assert from "node:assert/strict";
import {
  validSubject,
  validTask,
  validDate,
  toInstant,
  occurrences,
  overlaps,
  filterTasks,
  taskDay,
  dateAdd,
  weekStart,
} from "../src/features/planning/logic.ts";
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
test("date-only deadlines never shift, while timed deadlines follow the viewing zone", () => {
  const only = task("a", { due_on: "2026-09-14" }),
    timed = task("b", { due_at: "2026-09-14T00:30:00Z" });
  for (const zone of [
    "America/Los_Angeles",
    "Pacific/Kiritimati",
    "Africa/Cairo",
  ])
    assert.equal(taskDay(only, zone), "2026-09-14");
  assert.equal(taskDay(timed, "America/Los_Angeles"), "2026-09-13");
  assert.equal(validDate("2024-02-29"), true);
  assert.equal(validDate("2026-02-29"), false);
  assert.equal(dateAdd("2026-12-31", 1), "2027-01-01");
  assert.equal(weekStart("2026-09-14"), "2026-09-12");
});
test("Today, Upcoming and compound filters exclude completed tasks and sorting is stable", () => {
  const rows = [
    task("undated"),
    task("done", { due_on: "2026-09-10", status: "completed" }),
    task("tomorrow", {
      due_on: "2026-09-15",
      priority: "high",
      subject_id: "math",
    }),
    task("today", { due_on: "2026-09-14" }),
    task("late", { due_on: "2026-09-13" }),
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
