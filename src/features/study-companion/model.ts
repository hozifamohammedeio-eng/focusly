import { dateAdd, dayInZone, localParts, toInstant, validDate, validZone } from "@/features/planning/logic";

export type Locale = "ar" | "en";
export type Mood = "neutral" | "happy" | "thinking" | "reminder" | "celebrating";
export type CompanionPreference = { companion_name: string; enabled: boolean; auto_greeting_enabled: boolean };
export type CompanionTask = { id: string; title: string; subjectId: string | null; subjectName: string | null; day: string; priority: "low" | "medium" | "high"; estimatedMinutes: number | null };
export type CompanionBlock = { startsAt: string; endsAt: string; title: string };
export type CompanionContext = { today: string; zone: string; now: string; goalMinutes: number; studiedMinutes: number | null; tasks: CompanionTask[]; blocks: CompanionBlock[]; upcoming: CompanionBlock | null };
export type DayBlock = { taskId: string; title: string; startsAt: string; endsAt: string };
export type DayPlan = { blocks: DayBlock[]; day: string; zone: string; requestId: string };
export type ReminderProposal = { title: string; day: string; time: string; remindAt: string; zone: string; requestId: string };
export type AiIntent = "chat" | "suggest_task" | "suggest_focus" | "create_reminder_proposal" | "open_task" | "open_planner";
export type AiReply = { message: string; intent: AiIntent; taskId: string | null; reminder: { title: string; day: string; time: string } | null };

export function validCompanionName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 1 && [...value.trim()].length <= 40 &&
    !/[\x00-\x1f\x7f]/u.test(value);
}

export function parseAiReply(value: unknown): AiReply | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const x = value as Record<string, unknown>;
  if (typeof x.message !== "string" || !x.message.trim() || x.message.length > 700 ||
    !["chat", "suggest_task", "suggest_focus", "create_reminder_proposal", "open_task", "open_planner"].includes(String(x.intent)) ||
    !(x.taskId === null || typeof x.taskId === "string" && x.taskId.length <= 36) ||
    !(x.reminder === null || typeof x.reminder === "object" && !Array.isArray(x.reminder))) return null;
  const reminder = x.reminder as Record<string, unknown> | null;
  if (x.intent === "create_reminder_proposal") {
    if (!reminder || typeof reminder.title !== "string" || !reminder.title.trim() || reminder.title.length > 160 ||
      typeof reminder.day !== "string" || !validDate(reminder.day) ||
      typeof reminder.time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(reminder.time)) return null;
  }
  return x as AiReply;
}

export function reminderFromLocal(title: string, day: string, time: string, zone: string, now: number, requestId: string): ReminderProposal | null {
  if (!title.trim() || title.trim().length > 160 || /[\x00-\x1f\x7f]/u.test(title) || !validZone(zone) || !validDate(day)) return null;
  const instant = toInstant(day, time, zone);
  if (!instant || Date.parse(instant) <= now + 60_000 || Date.parse(instant) > now + 365 * 86400000) return null;
  return { title: title.trim(), day, time, zone, remindAt: instant, requestId };
}

export function rankedTasks(context: CompanionContext): CompanionTask[] {
  return [...context.tasks].sort((a, b) =>
    Number(a.day > context.today) - Number(b.day > context.today) ||
    a.day.localeCompare(b.day) ||
    ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority]) ||
    a.title.localeCompare(b.title));
}

export function makeDayPlan(context: CompanionContext, availableMinutes: number, requestId: string): DayPlan | null {
  if (!Number.isInteger(availableMinutes) || availableMinutes < 25 || availableMinutes > 240 || !validZone(context.zone)) return null;
  const tasks = rankedTasks(context).filter(task => task.day <= context.today).slice(0, 3);
  if (!tasks.length) return null;
  const parts = localParts(context.now, context.zone);
  let cursor = Math.ceil((Number(parts.time.slice(0, 2)) * 60 + Number(parts.time.slice(3)) + 5) / 15) * 15;
  const occupied = context.blocks.map(block => ({ start: Date.parse(block.startsAt), end: Date.parse(block.endsAt) }));
  const blocks: DayBlock[] = [];
  let remaining = availableMinutes;
  for (const task of tasks) {
    if (remaining < 25) break;
    const duration = Math.min(45, remaining, Math.max(25, task.estimatedMinutes ?? 25));
    for (let tries = 0; tries < 80 && cursor + duration < 24 * 60; tries++, cursor += 15) {
      const startTime = `${String(Math.floor(cursor / 60)).padStart(2, "0")}:${String(cursor % 60).padStart(2, "0")}`;
      const endMinutes = cursor + duration;
      const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
      const startsAt = toInstant(context.today, startTime, context.zone);
      const endsAt = toInstant(context.today, endTime, context.zone);
      if (!startsAt || !endsAt || Date.parse(startsAt) < Date.parse(context.now) ||
        occupied.some(slot => Date.parse(startsAt) < slot.end && slot.start < Date.parse(endsAt))) continue;
      blocks.push({ taskId: task.id, title: task.title, startsAt, endsAt });
      occupied.push({ start: Date.parse(startsAt), end: Date.parse(endsAt) });
      remaining -= duration;
      cursor = endMinutes + 5;
      break;
    }
  }
  return blocks.length ? { blocks, day: context.today, zone: context.zone, requestId } : null;
}

export function localReminderLabel(proposal: ReminderProposal, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", { dateStyle: "medium", timeStyle: "short", timeZone: proposal.zone }).format(new Date(proposal.remindAt));
}

export function tomorrow(context: CompanionContext): string { return dateAdd(dayInZone(context.now, context.zone), 1); }
