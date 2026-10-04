"use server";

import { revalidatePath } from "next/cache";
import { UUID, toInstant } from "@/features/planning/logic";
import { companionStudent } from "./data";
import { companionProviderBusy } from "./provider";
import { interpretAgentMessage } from "./agent-provider";
import type { Locale } from "./model";
import { executeTool } from "./tools/execute";
import { type AgentRef } from "./tools/resolve";
import { destructiveTools, directToolCommand, parseAgentDecision, resolveDay, writeTools, type AgentCall } from "./tools/registry";
import { dayEvents, loadAgentSnapshot, type AgentSnapshot, type Student } from "./tools/snapshot";

type Recent = { role: "student" | "companion"; text: string };
export type AgentOutcome = { ok: true; text: string; ref?: AgentRef; pending?: { calls: AgentCall[]; requestId: string };
  changed?: boolean; reminderCreated?: boolean; companionName?: string; companionSettingChanged?: boolean } |
  { ok: false; text: string };
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
  initial: { student: Student; snapshot: AgentSnapshot }): Promise<AgentOutcome> {
  const { student } = initial;
  let { snapshot } = initial;
  const messages: string[] = [];
  let ref: AgentRef | undefined;
  for (const [index, call] of calls.entries()) {
    const result = await executeTool(call, snapshot, student, locale, memory, requestId, index);
    if (!result.ok) return { ok: false, text: messages.length ? `${messages.join(" ")} ${result.message}` : result.message };
    messages.push(result.message); ref = result.ref ?? ref; memory = result.ref ?? memory;
    if (index < calls.length - 1) {
      try { snapshot = await loadAgentSnapshot(student); }
      catch { return { ok: false, text: `${messages.join(" ")} ${say(locale,
        "I couldn't check the next step, so I stopped there.", "معرفتش أتأكد من الخطوة اللي بعدها، فوقفت هنا.")}` }; }
    }
  }
  if (calls.some(call => writeTools.has(call.tool))) revalidatePath("/app", "layout");
  return { ok: true, text: messages.join(" "), ...(ref ? { ref } : {}),
    changed: calls.some(call => writeTools.has(call.tool)),
    ...(calls.some(call => call.tool === "create_reminder") ? { reminderCreated: true } : {}),
    ...(calls.some(call => call.tool === "set_companion_enabled" || call.tool === "set_auto_greeting")
      ? { companionSettingChanged: true } : {}),
    ...(calls.find(call => call.tool === "set_companion_name")?.args.value
      ? { companionName: calls.find(call => call.tool === "set_companion_name")!.args.value } : {}) };
}

/** Interpret one bounded turn; explicit simple commands may run without a modal. */
export async function agentMessage(message: string, locale: Locale, recent: Recent[], memory: AgentRef | null,
  requestId: string): Promise<AgentOutcome> {
  if (!validInput(message, locale, recent, memory, requestId))
    return fail(locale, "That request isn't clear yet.", "الطلب مش واضح كفاية.");
  try {
    const initial = await studentAndSnapshot();
    if (!initial) return fail(locale, "Please sign in and enable your companion first.", "سجل دخولك وفعّل رفيق المذاكرة الأول.");
    const snapshot = initial.snapshot;
    // A common read can be answered without an AI call or a write.
    if (/^(what do i have tomorrow\??|ايه عندي بكرة[؟?]?|عندي ايه بكرة[؟?]?)$/iu.test(message.trim())) {
      return perform([{ tool: "read_day", args: { day: "tomorrow" } }], locale, memory, requestId, initial);
    }
    const decision = await interpretAgentMessage(message.trim(), locale, snapshot, recent);
    if (!decision) return fail(locale, "I didn't quite get that. Could you try a shorter request?", "مش فاهمك قوي. ممكن تقولها بشكل أقصر؟");
    if (!decision.calls.length) return { ok: true, text: decision.message.trim() || say(locale, "Tell me a little more.", "قولّي تفاصيل أكتر شوية.") };
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
        pending: { calls, requestId } };
    }
    const confirm = calls.some(call => writeTools.has(call.tool)) &&
      (calls.length > 1 || calls.some(call => destructiveTools.has(call.tool)) || !decision.explicit || !directToolCommand(calls[0]!, message));
    if (confirm) return { ok: true, text: say(locale, calls.length > 1
      ? `I found ${calls.length} changes to make. Want me to apply them?` : "I can make that change. Should I go ahead?",
      calls.length > 1 ? `في ${calls.length} تغييرات. أطبّقهم؟` : "أقدر أعمل التغيير ده. أكمّل؟"),
      pending: { calls, requestId } };
    return perform(calls, locale, memory, requestId, initial);
  } catch (cause) {
    return fail(locale, companionProviderBusy(cause) ? "The AI service is busy. Try again shortly." : "I couldn't finish that request. Nothing was changed unless I said otherwise.",
      companionProviderBusy(cause) ? "خدمة الذكاء الاصطناعي مشغولة. جرّب كمان شوية." : "معرفتش أكمل الطلب. مفيش حاجة اتغيرت إلا لو قلتلك.");
  }
}

/** Explicit confirmation still re-authenticates, re-resolves, and revalidates ownership. */
export async function confirmAgentCalls(rawCalls: unknown, locale: Locale, memory: AgentRef | null,
  requestId: string): Promise<AgentOutcome> {
  const calls = safeCalls(rawCalls);
  if (!calls?.length || calls.length > 2 || !UUID.test(requestId) || !["ar", "en"].includes(locale) ||
    memory && (!UUID.test(memory.id) || !["task", "subject", "block", "reminder"].includes(memory.kind)))
    return fail(locale, "That proposal expired. Please ask again.", "الاقتراح ده انتهى. اسألني تاني.");
  try {
    const initial = await studentAndSnapshot();
    if (!initial) return fail(locale, "Please sign in again.", "سجل دخولك تاني.");
    return perform(calls, locale, memory, requestId, initial);
  } catch {
    return fail(locale, "I couldn't apply that. Please check the page before retrying.", "معرفتش أطبّق ده. راجع الصفحة قبل ما تجرب تاني.");
  }
}
