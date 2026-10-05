import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fastDecision } from "../src/features/study-companion/tools/fast-path.ts";
import { parseAgentContext, remember, validUndo, type AgentContext } from "../src/features/study-companion/tools/memory.ts";
import { taskMatch } from "../src/features/study-companion/tools/resolve.ts";
import { companionTone, safeConversationReply } from "../src/features/study-companion/tone.ts";
import type { AgentSnapshot } from "../src/features/study-companion/tools/snapshot.ts";

const id = (n: number) => `97000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const snapshot = { today: "2026-10-04", zone: "Africa/Cairo", tasks: [
  { id: id(1), title: "Physics homework", day: "2026-10-05", status: "todo" },
  { id: id(2), title: "Physics homework", day: "2026-10-08", status: "todo" },
], blocks: [{ id: id(3), title: "Physics", starts_at: "2026-10-05T14:00:00Z",
  ends_at: "2026-10-05T15:00:00Z", repeat_weekly: false, time_zone: "Africa/Cairo" }],
  subjects: [], schedule: [], reminders: [] } as unknown as AgentSnapshot;
const context = (memory: AgentContext["memory"] = {}, page: AgentContext["page"] = "planner"): AgentContext => ({ page, memory });

test("common Egyptian and English reads and settings use deterministic paths", () => {
  assert.equal(fastDecision("إيه اللي عندي بكرة؟", snapshot, context())?.calls[0]?.tool, "read_day");
  assert.equal(fastDecision("مهامي النهاردة", snapshot, context())?.calls[0]?.tool, "list_tasks");
  assert.equal(fastDecision("what do I have this week?", snapshot, context())?.calls[0]?.tool, "read_week");
  assert.deepEqual(fastDecision("غير هدفي لـ90 دقيقة", snapshot, context())?.calls[0]?.args, { value: "90" });
  assert.deepEqual(fastDecision("غير هدفي لـ٩٠ دقيقة", snapshot, context())?.calls[0]?.args, { value: "90" });
  assert.deepEqual(fastDecision("خلي الثيم dark", snapshot, context())?.calls[0]?.args, { value: "dark" });
  assert.deepEqual(fastDecision("خلي اللون أزرق", snapshot, context())?.calls[0]?.args, { value: "blue" });
  assert.deepEqual(fastDecision("اسمك يبقى Nova", snapshot, context())?.calls[0]?.args, { value: "Nova" });
  assert.equal(fastDecision("Remind me about programming tomorrow at 6 pm", snapshot, context())?.calls[0]?.tool, "create_reminder");
});

test("short follow-ups reuse only a current owned block and saved-zone time", () => {
  const memory = { refs: { block: { kind: "block" as const, id: id(3), title: "Physics" } },
    lastDay: "2026-10-05", lastIntent: "move_block" as const };
  assert.deepEqual(fastDecision("خليها 7", snapshot, context(memory))?.calls[0]?.args,
    { query: "it", fromDay: "2026-10-05", day: "2026-10-05", time: "19:00" });
  assert.equal(fastDecision("زودلها نص ساعة", snapshot, context(memory))?.calls[0]?.args.duration, 90);
  assert.equal(fastDecision("فكرني بيها قبلها بنص ساعة", snapshot, context(memory))?.calls[0]?.args.time, "16:30");
  const withLesson = { ...snapshot, schedule: [{ title: "English", weekday: 1, time: "18:00", zone: "Africa/Cairo" }] };
  assert.equal(fastDecision("خليها بعد الإنجليزي", withLesson, context(memory))?.calls[0]?.args.time, "19:00");
  assert.equal(fastDecision("طب وبكرة؟", snapshot, context({ lastIntent: "read_day" }))?.calls[0]?.args.day, "tomorrow");
  assert.equal(fastDecision("خليها 7", snapshot, context())?.calls[0], undefined);
});

test("correction and repetition require confirmation and retain a narrow tool", () => {
  const previous = { tool: "move_block" as const, args: { query: "Physics", day: "today", time: "18:00" } };
  const correction = fastDecision("لا مش دي، اللي بكرة", snapshot, context({ lastCall: previous }));
  assert.equal(correction?.confirm, true);
  assert.equal(correction?.calls[0]?.args.fromDay, "tomorrow");
  const same = fastDecision("اعمل نفس الكلام للعربي", snapshot,
    context({ lastCall: { tool: "create_block", args: { title: "Maths", subject: "Maths", day: "tomorrow", time: "19:00" } } }));
  assert.equal(same?.confirm, true);
  assert.equal(same?.calls[0]?.args.subject, "عربي");
});

test("session hints are bounded and cannot smuggle actions or foreign references", () => {
  const good = context({ refs: { task: { kind: "task", id: id(1), title: "Physics homework" } }, lastDay: "2026-10-05" });
  assert.ok(parseAgentContext(good));
  assert.equal(parseAgentContext({ ...good, owner: id(2) }), null);
  assert.equal(parseAgentContext(context({ lastCall: { tool: "run_sql" as never, args: {} } })), null);
  assert.equal(parseAgentContext(context({ refs: { task: { kind: "task", id: "not-a-uuid", title: "bad" } } })), null);
  assert.equal(taskMatch(snapshot, "it", undefined, { kind: "task", id: id(99), title: "Foreign" }).kind, "missing");
  assert.equal(taskMatch(snapshot, "it", "tomorrow", { kind: "task", id: id(2), title: "Physics homework" }).kind, "found");
  const next = remember({}, { tool: "read_day", args: { day: "tomorrow" } }, undefined, "2026-10-05");
  assert.equal(next.lastDay, "2026-10-05");
  assert.equal(Object.keys(next.refs ?? {}).length, 0);
});

test("undo is limited and tone avoids raw technical errors", () => {
  assert.equal(validUndo({ kind: "goal", before: 90, after: 120 }), true);
  assert.equal(validUndo({ kind: "goal", before: 900, after: 120 }), false);
  assert.equal(validUndo({ kind: "block", id: id(3), before: {}, after: {} }), false);
  assert.doesNotMatch(companionTone.understand("ar"), /SQL|RPC|JSON|database|Gemini/iu);
  assert.match(companionTone.undoDone("ar"), /تمام/u);
  assert.doesNotMatch(safeConversationReply("en", "Done, I deleted it", false), /deleted/iu);
  assert.match(safeConversationReply("ar", "ولا يهمك، نبدأ بالأقصر؟", false), /نبدأ/u);
  const css = readFileSync(new URL("../src/features/study-companion/companion.module.css", import.meta.url), "utf8");
  const panel = readFileSync(new URL("../src/features/study-companion/panel.tsx", import.meta.url), "utf8");
  assert.match(css, /prefers-reduced-motion/u);
  assert.match(css, /max-width: 640px/u);
  assert.match(panel, /requestSubmit/u);
  assert.match(panel, /inFlight\.current/u);
  assert.match(panel, /role="group"/u);
  const workspace = readFileSync(new URL("../src/features/planning/workspace.tsx", import.meta.url), "utf8");
  assert.match(workspace, /focusly-agent-selection/u);
});
