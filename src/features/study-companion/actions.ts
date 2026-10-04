"use server";

import { revalidatePath } from "next/cache";
import { UUID, dayInZone, toInstant, validText, validZone } from "@/features/planning/logic";
import { companionCopy } from "./copy";
import { companionStudent, ownedContext, ownedPreferences } from "./data";
import { rankedTasks, makeDayPlan, reminderFromLocal, validCompanionName,
  type AiReply, type CompanionPreference, type DayPlan, type Locale, type ReminderProposal } from "./model";
import { companionProviderBusy, requestCompanionReply } from "./provider";

type ErrorCode = "expired" | "invalid" | "unavailable" | "conflict" | "busy";
type Result<T> = { ok: true; value: T } | { ok: false; error: ErrorCode };
const failed = (error: ErrorCode) => ({ ok: false, error }) as const;
const validLocale = (locale: string): locale is Locale => locale === "ar" || locale === "en";

export async function companionBootstrap(): Promise<Result<{ owner: string; preference: CompanionPreference | null }>> {
  try {
    const value = await ownedPreferences();
    return value ? { ok: true, value } : failed("expired");
  } catch { return failed("unavailable"); }
}

export async function companionContext() {
  try {
    const context = await ownedContext();
    return context ? { ok: true as const, value: context } : failed("expired");
  } catch { return failed("unavailable"); }
}

export async function saveCompanionName(input: string): Promise<Result<{ name: string }>> {
  const name = typeof input === "string" ? input.trim() : "";
  if (!validCompanionName(name)) return failed("invalid");
  try {
    const student = await companionStudent();
    if (!student) return failed("expired");
    const result = await student.client.from("study_companion_preferences")
      .upsert({ user_id: student.user.id, companion_name: name }, { onConflict: "user_id" });
    if (result.error) return failed("unavailable");
    return { ok: true, value: { name } };
  } catch { return failed("unavailable"); }
}

export async function saveCompanionPreferences(enabled: boolean, autoGreetingEnabled: boolean): Promise<Result<true>> {
  if (typeof enabled !== "boolean" || typeof autoGreetingEnabled !== "boolean") return failed("invalid");
  try {
    const student = await companionStudent();
    if (!student) return failed("expired");
    const result = await student.client.from("study_companion_preferences")
      .update({ enabled, auto_greeting_enabled: autoGreetingEnabled })
      .eq("user_id", student.user.id).select("user_id").single();
    return result.error ? failed("unavailable") : { ok: true, value: true };
  } catch { return failed("unavailable"); }
}

export async function suggestStudyNow(locale: Locale): Promise<Result<{ message: string; taskId: string | null }>> {
  if (!validLocale(locale)) return failed("invalid");
  try {
    const context = await ownedContext();
    if (!context) return failed("expired");
    const task = rankedTasks(context)[0];
    if (!task) return { ok: true, value: { message: companionCopy[locale].noTasks, taskId: null } };
    const t = companionCopy[locale];
    const reason = task.day < context.today ? t.overdueReason : task.day === context.today ? t.todayReason : t.priorityReason;
    return { ok: true, value: { message: t.suggested(task.title, reason), taskId: task.id } };
  } catch { return failed("unavailable"); }
}

export async function proposeDayPlan(locale: Locale, availableMinutes: number): Promise<Result<{ message: string; plan: DayPlan | null }>> {
  if (!validLocale(locale) || !Number.isInteger(availableMinutes) || availableMinutes < 25 || availableMinutes > 240) return failed("invalid");
  try {
    const context = await ownedContext();
    if (!context) return failed("expired");
    const plan = makeDayPlan(context, availableMinutes, crypto.randomUUID());
    return { ok: true, value: { message: plan ? companionCopy[locale].planReady : companionCopy[locale].planNone, plan } };
  } catch { return failed("unavailable"); }
}

export async function applyDayPlan(plan: DayPlan): Promise<Result<{ sessions: number; alreadySaved: boolean }>> {
  if (!plan || !UUID.test(plan.requestId) || !Array.isArray(plan.blocks) || plan.blocks.length < 1 || plan.blocks.length > 3) return failed("invalid");
  try {
    const student = await companionStudent();
    if (!student) return failed("expired");
    const zone = student.settings.time_zone || "UTC";
    const today = dayInZone(Date.now(), zone);
    if (plan.zone !== zone || plan.day !== today || plan.blocks.some(block =>
      !UUID.test(block.taskId) || !validText(block.title, 200) ||
      !Number.isFinite(Date.parse(block.startsAt)) || !Number.isFinite(Date.parse(block.endsAt)) ||
      dayInZone(block.startsAt, zone) !== today || dayInZone(block.endsAt, zone) !== today ||
      Date.parse(block.endsAt) - Date.parse(block.startsAt) < 15 * 60000 ||
      Date.parse(block.endsAt) - Date.parse(block.startsAt) > 120 * 60000
    )) return failed("invalid");
    // Schedule's weekly lessons have a local start but no duration. Reserve an
    // hour in the proposal and recheck those owner-owned commitments at save.
    const schedule = await student.client.from("study_schedule_items").select("local_time,weekday,time_zone")
      .eq("user_id", student.user.id).eq("enabled", true);
    if (schedule.error) return failed("unavailable");
    for (const item of schedule.data) {
      if (!item.local_time || !validZone(item.time_zone)) continue;
      if (plan.blocks.some(block => {
        const localDay = dayInZone(block.startsAt, item.time_zone);
        if (new Date(localDay + "T12:00:00Z").getUTCDay() !== item.weekday) return false;
        const startsAt = toInstant(localDay, item.local_time!.slice(0, 5), item.time_zone);
        return startsAt !== null && Date.parse(block.startsAt) < Date.parse(startsAt) + 60 * 60000 && Date.parse(startsAt) < Date.parse(block.endsAt);
      }))
        return failed("conflict");
    }
    const result = await student.client.rpc("apply_companion_day_plan", { p_request_id: plan.requestId, p_blocks: plan.blocks });
    if (result.error) return failed(result.error.code === "23P01" ? "conflict" : "unavailable");
    if (!result.data || typeof result.data !== "object" || Array.isArray(result.data)) return failed("unavailable");
    revalidatePath("/app", "layout");
    const value = result.data as Record<string, unknown>;
    return { ok: true, value: { sessions: Number(value.sessions) || 0, alreadySaved: value.alreadySaved === true } };
  } catch { return failed("unavailable"); }
}

export async function askCompanion(message: string, locale: Locale,
  recent: { role: "student" | "companion"; text: string }[]): Promise<Result<{ reply: AiReply; proposal: ReminderProposal | null }>> {
  if (!validLocale(locale) || typeof message !== "string" || !message.trim() || message.length > 500 ||
    !Array.isArray(recent) || recent.length > 4 || recent.some(item =>
      !item || !["student", "companion"].includes(item.role) || typeof item.text !== "string" || item.text.length > 500)) return failed("invalid");
  try {
    const preference = await ownedPreferences();
    if (!preference || !preference.preference?.enabled) return failed("expired");
    const context = await ownedContext();
    if (!context) return failed("unavailable");
    const reply = await requestCompanionReply(message.trim(), locale, context, recent);
    if (!reply) {
      return { ok: true, value: { reply: { message: companionCopy[locale].tryAgain, intent: "chat", taskId: null, reminder: null }, proposal: null } };
    }
    if (reply.taskId && !context.tasks.some(task => task.id === reply.taskId)) {
      reply.intent = "chat"; reply.taskId = null;
    }
    const proposal = reply.intent === "create_reminder_proposal" && reply.reminder
      ? reminderFromLocal(reply.reminder.title, reply.reminder.day, reply.reminder.time, context.zone, Date.now(), crypto.randomUUID()) : null;
    if (reply.intent === "create_reminder_proposal" && !proposal) {
      reply.intent = "chat"; reply.reminder = null;
      reply.message = companionCopy[locale].tryAgain;
    }
    return { ok: true, value: { reply, proposal } };
  } catch (error) { return failed(companionProviderBusy(error) ? "busy" : "unavailable"); }
}

export async function createStudyReminder(proposal: ReminderProposal): Promise<Result<{ id: string; alreadySaved: boolean }>> {
  if (!proposal || !UUID.test(proposal.requestId)) return failed("invalid");
  try {
    const student = await companionStudent();
    if (!student) return failed("expired");
    const zone = student.settings.time_zone || "UTC";
    const checked = reminderFromLocal(proposal.title, proposal.day, proposal.time, zone, Date.now(), proposal.requestId);
    if (!checked || proposal.zone !== zone || checked.remindAt !== proposal.remindAt) return failed("invalid");
    const owner = student.user.id;
    const insert = await student.client.from("study_reminders").insert({ user_id: owner, request_id: proposal.requestId,
      title: checked.title, remind_at: checked.remindAt }).select("id").single();
    if (!insert.error) return { ok: true, value: { id: insert.data.id, alreadySaved: false } };
    if (insert.error.code !== "23505") return failed("unavailable");
    const existing = await student.client.from("study_reminders").select("id,title,remind_at")
      .eq("user_id", owner).eq("request_id", proposal.requestId).single();
    if (existing.error || existing.data.title !== checked.title || existing.data.remind_at !== checked.remindAt) return failed("invalid");
    return { ok: true, value: { id: existing.data.id, alreadySaved: true } };
  } catch { return failed("unavailable"); }
}

export async function dueStudyReminders(): Promise<Result<{ id: string; title: string }[]>> {
  try {
    const student = await companionStudent();
    if (!student) return failed("expired");
    const result = await student.client.rpc("claim_due_study_reminders");
    if (result.error) return failed("unavailable");
    return { ok: true, value: result.data.map(item => ({ id: item.id, title: item.title })) };
  } catch { return failed("unavailable"); }
}

export async function upcomingStudyReminders(): Promise<Result<{ id: string; title: string; remindAt: string }[]>> {
  try {
    const student = await companionStudent();
    if (!student) return failed("expired");
    const result = await student.client.from("study_reminders").select("id,title,remind_at")
      .eq("user_id", student.user.id).eq("status", "scheduled").gte("remind_at", new Date().toISOString())
      .order("remind_at").limit(10);
    if (result.error) return failed("unavailable");
    return { ok: true, value: result.data.map(item => ({ id: item.id, title: item.title, remindAt: item.remind_at })) };
  } catch { return failed("unavailable"); }
}
