"use server";

import { revalidatePath } from "next/cache";
import { UUID, dayInZone, localParts, toInstant } from "@/features/planning/logic";
import { companionStudent } from "./data";
import { companionProviderBusy } from "./provider";
import { interpretAgentMessage } from "./agent-provider";
import type { Locale } from "./model";
import { executeTool } from "./tools/execute";
import type { AgentCard, AgentChoice } from "./tools/execute";
import { type AgentRef } from "./tools/resolve";
import { destructiveTools, directToolCommand, explicitCommand, parseAgentDecision, resolveDay, writeTools, type AgentCall } from "./tools/registry";
import { dayEvents, loadAgentSnapshot, type AgentSnapshot, type Student } from "./tools/snapshot";
import { fastDecision } from "./tools/fast-path";
import { parseAgentContext, remember, validUndo, type AgentContext, type AgentMemory, type AgentUndo } from "./tools/memory";
import { companionTone, safeConversationReply } from "./tone";

type Recent = { role: "student" | "companion"; text: string };
export type AgentOutcome = { ok: true; text: string; ref?: AgentRef; pending?: { calls: AgentCall[]; requestId: string };
  choice?: { call: AgentCall; requestId: string; options: AgentChoice[] }; memory?: AgentMemory;
  card?: AgentCard; changed?: boolean; reminderCreated?: boolean; companionName?: string; companionSettingChanged?: boolean } |
  { ok: false; text: string; memory?: AgentMemory };
const say = (locale: Locale, en: string, ar: string) => locale === "ar" ? ar : en;
const fail = (locale: Locale, en: string, ar: string): AgentOutcome => ({ ok: false, text: say(locale, en, ar) });
function validInput(message: string, locale: Locale, recent: Recent[], memory: AgentRef | null, requestId: string): boolean {
  return (locale === "ar" || locale === "en") && typeof message === "string" && !!message.trim() && message.length <= 500 &&
    UUID.test(requestId) && Array.isArray(recent) && recent.length <= 4 && recent.every(item => item &&
      (item.role === "student" || item.role === "companion") && typeof item.text === "string" && item.text.length <= 500) &&
    (!memory || UUID.test(memory.id) && ["task", "subject", "block", "reminder"].includes(memory.kind) &&
      typeof memory.title === "string" && memory.title.length <= 200);
}
function safeCalls(value: unknown): AgentCall[] | null {
  const decision = parseAgentDecision({ message: "", explicit: false, calls: value });
  return decision?.calls ?? null;
}
async function studentAndSnapshot(): Promise<{ student: Student; snapshot: AgentSnapshot } | null> {
  const student = await companionStudent(); if (!student) return null;
  const preference = await student.client.from("study_companion_preferences")
    .select("companion_name,enabled,auto_greeting_enabled").eq("user_id", student.user.id).maybeSingle();
  if (preference.error || !preference.data?.enabled) return null;
  const snapshot = await loadAgentSnapshot(student);
  snapshot.companionName = preference.data.companion_name;
  snapshot.companionEnabled = preference.data.enabled;
  snapshot.autoGreetingEnabled = preference.data.auto_greeting_enabled;
  return { student, snapshot };
}

function plannedSlot(snapshot: AgentSnapshot, day: string): AgentCall | null {
  const task = snapshot.tasks.find(item => item.day <= day && item.status !== "completed" && item.subjectId &&
    snapshot.subjects.some(subject => subject.id === item.subjectId && !subject.archived));
  if (!task) return null;
  const subject = snapshot.subjects.find(item => item.id === task.subjectId)!;
  const events = dayEvents(snapshot, day);
  const occupied = [...events.blocks.map(item => [Date.parse(item.starts), Date.parse(item.ends)]),
    ...events.lessons.map(item => [Date.parse(item.starts), Date.parse(item.ends)])];
  for (let hour = 9; hour <= 20; hour++) for (const minute of [0, 30]) {
    const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    const start = toInstant(day, time, snapshot.zone); if (!start || Date.parse(start) < Date.parse(snapshot.now) + 10 * 60000) continue;
    const end = Date.parse(start) + 25 * 60000;
    if (occupied.some(([a, b]) => Date.parse(start) < b! && a! < end)) continue;
    return { tool: "create_block", args: { title: task.title, subject: subject.name, day, time, duration: 25 } };
  }
  return null;
}

async function perform(calls: AgentCall[], locale: Locale, memory: AgentRef | null, requestId: string,
  initial: { student: Student; snapshot: AgentSnapshot }, session: AgentMemory = {}, preferredReference?: AgentRef): Promise<AgentOutcome> {
  const { student } = initial;
  let { snapshot } = initial;
  const messages: string[] = [];
  let ref: AgentRef | undefined;
  let card: AgentCard | undefined;
  for (const [index, call] of calls.entries()) {
    const kind = call.tool.includes("task") ? "task" : call.tool.includes("subject") ? "subject"
      : call.tool.includes("block") ? "block" : call.tool.includes("reminder") ? "reminder" : null;
    const reference = preferredReference ?? (kind ? session.refs?.[kind as AgentRef["kind"]] ?? memory : memory);
    const result = await executeTool(call, snapshot, student, locale, reference ?? null, requestId, index);
    if (!result.ok) {
      if (result.choices?.length && calls.length === 1) return { ok: true, text: companionTone.clarify(locale),
        choice: { call, requestId, options: result.choices },
        memory: { ...session, lastCall: call, lastIntent: call.tool } };
      return { ok: false, text: messages.length ? `${messages.join(" ")} ${result.message}` : result.message, memory: session };
    }
    messages.push(result.message); ref = result.ref ?? ref; memory = result.ref ?? memory;
    card = result.card ?? card;
    session = remember(session, call, result.ref, call.args.day ? resolveDay(call.args.day, snapshot.today) ?? undefined : undefined, result.undo);
    if (index < calls.length - 1) {
      try { snapshot = await loadAgentSnapshot(student); }
      catch { return { ok: false, text: `${messages.join(" ")} ${say(locale,
        "I couldn't check the next step, so I stopped there.", "معرفتش أتأكد من الخطوة اللي بعدها، فوقفت هنا.")}` }; }
    }
  }
  if (calls.some(call => writeTools.has(call.tool))) revalidatePath("/app", "layout");
  return { ok: true, text: messages.join(" "), ...(ref ? { ref } : {}), ...(card ? { card } : {}), memory: session,
    changed: calls.some(call => writeTools.has(call.tool)),
    ...(calls.some(call => call.tool === "create_reminder") ? { reminderCreated: true } : {}),
    ...(calls.some(call => call.tool === "set_companion_enabled" || call.tool === "set_auto_greeting")
      ? { companionSettingChanged: true } : {}),
    ...(calls.find(call => call.tool === "set_companion_name")?.args.value
      ? { companionName: calls.find(call => call.tool === "set_companion_name")!.args.value } : {}) };
}

/** Interpret one bounded turn; explicit simple commands may run without a modal. */
export async function agentMessage(message: string, locale: Locale, recent: Recent[], memory: AgentRef | null,
  requestId: string, rawContext?: AgentContext): Promise<AgentOutcome> {
  if (!validInput(message, locale, recent, memory, requestId))
    return fail(locale, "That request isn't clear yet.", "الطلب مش واضح كفاية.");
  try {
    const initial = await studentAndSnapshot();
    if (!initial) return fail(locale, "Please sign in and enable your companion first.", "سجل دخولك وفعّل رفيق المذاكرة الأول.");
    const snapshot = initial.snapshot;
    const context = rawContext ? parseAgentContext(rawContext) : { page: "other" as const, memory: {} };
    if (!context) return fail(locale, "That context expired. Please try again.", "السياق ده انتهى. جرّب تاني.");
    const session = context.memory;
    if (/^(?:undo|undo that|رجعها|رجعه|رجعها زي (?:الاول|الأول)|لا رجع المعاد)$/iu.test(message.trim()))
      return undoAgentAction(session.undo, locale);
    const fast = fastDecision(message.trim(), snapshot, context);
    if (fast) {
      if (fast.confirm) return { ok: true, text: companionTone.confirm(locale, fast.calls.length),
        pending: { calls: fast.calls, requestId }, memory: { ...session, lastCall: fast.calls[0]!, lastIntent: fast.calls[0]!.tool } };
      return perform(fast.calls, locale, memory, requestId, initial, session);
    }
    // A common read can be answered without an AI call or a write.
    if (/^(what do i have tomorrow\??|ايه عندي بكرة[؟?]?|عندي ايه بكرة[؟?]?)$/iu.test(message.trim())) {
      return perform([{ tool: "read_day", args: { day: "tomorrow" } }], locale, memory, requestId, initial, session);
    }
    const decision = await interpretAgentMessage(message.trim(), locale, snapshot, recent, context);
    if (!decision) return { ok: false, text: companionTone.understand(locale) };
    if (!decision.calls.length) return { ok: true,
      text: safeConversationReply(locale, decision.message, explicitCommand(message)),
      memory: session };
    let calls = decision.calls;
    if (calls.length === 1 && calls[0]!.tool === "plan_day") {
      const target = resolveDay(calls[0]!.args.day, snapshot.today);
      if (!target) return fail(locale, "Which day should we plan?", "تحب نخطط لأنهي يوم؟");
      const proposed = plannedSlot(snapshot, target);
      if (!proposed) return fail(locale, "I couldn't find a suitable free slot for a subject task. Let's check Planner together.",
        "ملقتش وقت مناسب لمهمة مرتبطة بمادة. خلينا نبص على المخطط سوا.");
      calls = [proposed];
      return { ok: true, text: say(locale, `How about ${proposed.args.title} at ${proposed.args.time} on ${target}? Apply it?`,
        `إيه رأيك نحط ${proposed.args.title} الساعة ${proposed.args.time} يوم ${target}؟ أطبّقها؟`),
        pending: { calls, requestId }, memory: { ...session, lastCall: calls[0]!, lastIntent: calls[0]!.tool } };
    }
    const confirm = calls.some(call => writeTools.has(call.tool)) &&
      (calls.length > 1 || calls.some(call => destructiveTools.has(call.tool)) || !decision.explicit || !directToolCommand(calls[0]!, message));
    if (confirm) return { ok: true, text: companionTone.confirm(locale, calls.length),
      pending: { calls, requestId }, memory: { ...session, lastCall: calls[0]!, lastIntent: calls[0]!.tool } };
    return perform(calls, locale, memory, requestId, initial, session);
  } catch (cause) {
    return { ok: false, text: companionProviderBusy(cause) ? companionTone.busy(locale) : companionTone.understand(locale) };
  }
}

/** Explicit confirmation still re-authenticates, re-resolves, and revalidates ownership. */
export async function confirmAgentCalls(rawCalls: unknown, locale: Locale, memory: AgentRef | null,
  requestId: string, rawContext?: AgentContext): Promise<AgentOutcome> {
  const calls = safeCalls(rawCalls);
  if (!calls?.length || calls.length > 2 || !UUID.test(requestId) || !["ar", "en"].includes(locale) ||
    memory && (!UUID.test(memory.id) || !["task", "subject", "block", "reminder"].includes(memory.kind)))
    return fail(locale, "That proposal expired. Please ask again.", "الاقتراح ده انتهى. اسألني تاني.");
  try {
    const initial = await studentAndSnapshot();
    if (!initial) return fail(locale, "Please sign in again.", "سجل دخولك تاني.");
    const context = rawContext ? parseAgentContext(rawContext) : { page: "other" as const, memory: {} };
    if (!context) return fail(locale, "That proposal expired. Please ask again.", "الاقتراح ده انتهى. اسألني تاني.");
    return perform(calls, locale, memory, requestId, initial, context.memory);
  } catch {
    return fail(locale, "I couldn't apply that. Please check the page before retrying.", "معرفتش أطبّق ده. راجع الصفحة قبل ما تجرب تاني.");
  }
}

/** A choice is a reference hint, never a user ID or authorization decision. */
export async function chooseAgentCandidate(rawCall: unknown, rawRef: unknown, locale: Locale, requestId: string,
  rawContext?: AgentContext): Promise<AgentOutcome> {
  const calls = safeCalls([rawCall]);
  const ref = rawRef as AgentRef;
  if (!calls?.length || !UUID.test(requestId) || !ref || !UUID.test(ref.id) ||
    !["task", "subject", "block", "reminder"].includes(ref.kind) || typeof ref.title !== "string" || ref.title.length > 200)
    return fail(locale, "That choice expired. Please ask again.", "الاختيار ده انتهى. اسألني تاني.");
  const call = calls[0]!;
  const expectedKind = call.tool.includes("task") ? "task" : call.tool.includes("subject") ? "subject"
    : call.tool.includes("block") ? "block" : call.tool.includes("reminder") ? "reminder" : null;
  const subjectChoice = ref.kind === "subject" && !!call.args.subject &&
    ["create_task", "update_task", "create_block"].includes(call.tool);
  if (ref.kind !== expectedKind && !subjectChoice || !["query", "fromDay", "day", "subject"].some(key => key in call.args))
    return fail(locale, "That choice doesn't match the request.", "الاختيار مش مطابق للطلب.");
  try {
    const initial = await studentAndSnapshot();
    if (!initial) return fail(locale, "Please sign in again.", "سجل دخولك تاني.");
    const context = rawContext ? parseAgentContext(rawContext) : { page: "other" as const, memory: {} };
    if (!context) return fail(locale, "That choice expired. Please ask again.", "الاختيار ده انتهى. اسألني تاني.");
    const rows = ref.kind === "task" ? initial.snapshot.tasks : ref.kind === "subject" ? initial.snapshot.subjects
      : ref.kind === "block" ? initial.snapshot.blocks : initial.snapshot.reminders;
    const owned = rows.find(row => row.id === ref.id);
    if (!owned) return fail(locale, "I couldn't find that item anymore.", "مش لاقي الحاجة دي دلوقتي.");
    const day = ref.kind === "block" ? dayInZone((owned as { starts_at: string }).starts_at, initial.snapshot.zone)
      : ref.kind === "task" ? (owned as { day: string }).day : undefined;
    const selected: AgentCall = { tool: call.tool, args: { ...call.args,
      ...(subjectChoice ? { subject: "it" } : { query: "it" }),
      ...(day ? { fromDay: day } : {}) } };
    return perform([selected], locale, ref, requestId, initial, context.memory, ref);
  } catch {
    return fail(locale, "I couldn't check that choice. Try again.", "معرفتش أتأكد من الاختيار. جرّب تاني.");
  }
}

/** Only the immediately preceding goal or Planner edit can be reversed. */
export async function undoAgentAction(rawUndo: unknown, locale: Locale): Promise<AgentOutcome> {
  if (!validUndo(rawUndo)) return { ok: false, text: companionTone.undoUnavailable(locale) };
  const undo: AgentUndo = rawUndo;
  try {
    const initial = await studentAndSnapshot();
    if (!initial) return fail(locale, "Please sign in again.", "سجل دخولك تاني.");
    if (undo.kind === "goal") {
      if (initial.snapshot.goal !== undo.after) return { ok: false, text: companionTone.undoUnavailable(locale) };
      const result = await initial.student.client.from("profiles").update({ daily_goal_minutes: undo.before })
        .eq("id", initial.student.user.id).eq("daily_goal_minutes", undo.after).select("id").single();
      if (result.error) return { ok: false, text: companionTone.undoUnavailable(locale) };
    } else {
      const block = initial.snapshot.blocks.find(item => item.id === undo.id);
      if (!block || block.title !== undo.after.title || block.starts_at !== undo.after.start ||
        block.ends_at !== undo.after.end) return { ok: false, text: companionTone.undoUnavailable(locale) };
      const previousDay = dayInZone(undo.before.start, initial.snapshot.zone);
      const currentDay = dayInZone(undo.after.start, initial.snapshot.zone);
      const result = await executeTool({ tool: "move_block", args: { query: "it", fromDay: currentDay,
        day: previousDay, time: localParts(undo.before.start, initial.snapshot.zone).time,
        duration: Math.round((Date.parse(undo.before.end) - Date.parse(undo.before.start)) / 60000),
        title: undo.before.title } }, initial.snapshot, initial.student, locale,
      { kind: "block", id: block.id, title: block.title }, crypto.randomUUID(), 0);
      if (!result.ok) return { ok: false, text: result.message };
    }
    revalidatePath("/app", "layout");
    return { ok: true, text: companionTone.undoDone(locale), changed: true, memory: {} };
  } catch { return { ok: false, text: companionTone.undoUnavailable(locale) }; }
}
