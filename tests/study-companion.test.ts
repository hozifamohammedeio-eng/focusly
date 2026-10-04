import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { companionCopy } from "../src/features/study-companion/copy.ts";
import { automaticGreeting, shouldAutoOpen } from "../src/features/study-companion/greeting.ts";
import { makeDayPlan, parseAiReply, reminderFromLocal, validCompanionName,
  type CompanionContext } from "../src/features/study-companion/model.ts";

const context: CompanionContext = {
  today: "2026-10-04", zone: "Africa/Cairo", now: "2026-10-04T10:00:00Z",
  goalMinutes: 120, studiedMinutes: 0, upcoming: null,
  tasks: [{ id: "98000000-0000-4000-8000-000000000001", title: "Chemistry", subjectId: null,
    subjectName: null, day: "2026-10-04", priority: "high", estimatedMinutes: 25 }],
  blocks: [{ startsAt: "2026-10-04T10:15:00Z", endsAt: "2026-10-04T11:00:00Z", title: "Fixed lecture" }],
};

test("companion naming trims and supports Arabic and Unicode with a 40-character boundary", () => {
  assert.equal(validCompanionName("  سند  "), true);
  assert.equal(validCompanionName("Buddy"), true);
  assert.equal(validCompanionName("  "), false);
  assert.equal(validCompanionName("x".repeat(41)), false);
  assert.equal(validCompanionName("Bad\nName"), false);
});

test("automatic greeting chooses real work, respects session frequency and opt-out", () => {
  assert.match(automaticGreeting(context, "en"), /1 task/);
  assert.match(automaticGreeting(context, "ar"), /مهم/);
  assert.equal(shouldAutoOpen(false, true, true, true), true);
  assert.equal(shouldAutoOpen(true, true, true, false), true);
  assert.equal(shouldAutoOpen(true, true, true, true), false);
  assert.equal(shouldAutoOpen(true, true, false, false), false);
  assert.equal(shouldAutoOpen(true, false, true, false), false);
});

test("English and Arabic quick actions are localized and bounded", () => {
  assert.deepEqual([companionCopy.en.studyNow, companionCopy.en.planDay, companionCopy.en.remind],
    ["What should I study now?", "Plan my day", "Remind me"]);
  assert.deepEqual([companionCopy.ar.studyNow, companionCopy.ar.planDay, companionCopy.ar.remind],
    ["ماذا أذاكر الآن؟", "خطط لي يومي", "فكرني بحاجة"]);
});

test("day plan preview respects fixed blocks and does not mutate the source", () => {
  const original = structuredClone(context);
  const plan = makeDayPlan(context, 60, "98000000-0000-4000-8000-000000000020");
  assert.ok(plan);
  assert.ok(Date.parse(plan.blocks[0]!.startsAt) >= Date.parse(context.blocks[0]!.endsAt));
  assert.deepEqual(context, original);
  assert.equal(makeDayPlan(context, 0, "request"), null);
});

test("reminder proposal validates local time, DST gaps, and future boundary", () => {
  assert.equal(reminderFromLocal("Chemistry", "2026-03-08", "02:30", "America/New_York", Date.parse("2026-03-07T00:00:00Z"), "id"), null);
  assert.equal(reminderFromLocal("  ", "2026-10-05", "19:00", "Africa/Cairo", Date.parse(context.now), "id"), null);
  const reminder = reminderFromLocal(" History ", "2026-10-05", "19:00", "Africa/Cairo", Date.parse(context.now), "id");
  assert.equal(reminder?.title, "History");
  assert.equal(reminder?.remindAt, "2026-10-05T16:00:00.000Z");
});

test("malformed AI output cannot become an action", () => {
  assert.equal(parseAiReply({ message: "Done", intent: "write_sql", taskId: null, reminder: null }), null);
  assert.equal(parseAiReply({ message: "Done", intent: "create_reminder_proposal", taskId: null, reminder: { title: "Test", day: "tomorrow", time: "7 PM" } }), null);
  assert.equal(parseAiReply({ message: "Done", intent: "chat", taskId: null, reminder: null })?.intent, "chat");
});

test("panel requires explicit confirmation for proposed plans and agent writes; animation respects reduced motion", () => {
  const panel = readFileSync(new URL("../src/features/study-companion/panel.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/features/study-companion/companion.module.css", import.meta.url), "utf8");
  assert.match(panel, /onClick=\{apply\}/);
  assert.match(panel, /onClick=\{confirmAgent\}/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});
