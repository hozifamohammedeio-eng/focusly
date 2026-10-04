import { dateAdd, validDate, weekday } from "@/features/planning/logic";

export const toolKeys = [
  "read_day", "read_week", "list_tasks", "create_task", "update_task", "complete_task", "delete_task",
  "list_subjects", "create_subject", "update_subject", "delete_subject",
  "create_block", "move_block", "delete_block", "list_schedule",
  "list_reminders", "create_reminder", "edit_reminder", "cancel_reminder",
  "read_settings", "set_goal", "set_locale", "set_theme", "set_accent", "set_display_name", "set_companion_name",
  "set_companion_enabled", "set_auto_greeting",
  "read_focus", "read_progress", "read_achievements", "read_challenges", "read_city", "plan_day",
] as const;
export type ToolKey = typeof toolKeys[number];
export type AgentArgs = Partial<Record<"query" | "title" | "day" | "fromDay" | "time" | "fromTime" | "subject" |
  "priority" | "notes" | "color" | "value" | "status", string>> & { duration?: number };
export type AgentCall = { tool: ToolKey; args: AgentArgs };
export type AgentDecision = { message: string; calls: AgentCall[]; explicit: boolean };

const allowed: Record<ToolKey, readonly (keyof AgentArgs)[]> = {
  read_day: ["day"], read_week: ["day"], list_tasks: ["query", "day"],
  create_task: ["title", "day", "time", "subject", "priority", "notes"],
  update_task: ["query", "fromDay", "title", "day", "time", "subject", "priority", "notes"],
  complete_task: ["query", "day", "status"], delete_task: ["query", "day"],
  list_subjects: [], create_subject: ["title", "color"], update_subject: ["query", "title", "color"], delete_subject: ["query"],
  create_block: ["title", "subject", "day", "time", "duration"],
  move_block: ["query", "fromDay", "fromTime", "day", "time", "duration", "title"],
  delete_block: ["query", "day", "fromTime"], list_schedule: ["day"],
  list_reminders: [], create_reminder: ["title", "day", "time"],
  edit_reminder: ["query", "title", "day", "time"], cancel_reminder: ["query"],
  read_settings: [], set_goal: ["value"], set_locale: ["value"], set_theme: ["value"],
  set_accent: ["value"], set_display_name: ["value"], set_companion_name: ["value"],
  set_companion_enabled: ["value"], set_auto_greeting: ["value"],
  read_focus: [], read_progress: [], read_achievements: [], read_challenges: [], read_city: [], plan_day: ["day", "duration"],
};
export const writeTools = new Set<ToolKey>(toolKeys.filter(key => ![
  "read_day", "read_week", "list_tasks", "list_subjects", "list_schedule", "list_reminders", "read_settings", "read_focus", "read_progress",
  "read_achievements", "read_challenges", "read_city", "plan_day",
].includes(key)));
export const destructiveTools = new Set<ToolKey>(["delete_task", "delete_subject", "delete_block", "cancel_reminder"]);

export function parseAgentDecision(value: unknown): AgentDecision | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.message !== "string" || row.message.length > 500 || typeof row.explicit !== "boolean" ||
    !Array.isArray(row.calls) || row.calls.length > 2 ||
    Object.keys(row).some(key => !["message", "explicit", "calls"].includes(key))) return null;
  const calls: AgentCall[] = [];
  for (const raw of row.calls) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const item = raw as Record<string, unknown>;
    if (!toolKeys.includes(item.tool as ToolKey) || !item.args || typeof item.args !== "object" || Array.isArray(item.args) ||
      Object.keys(item).some(key => !["tool", "args"].includes(key))) return null;
    const tool = item.tool as ToolKey;
    const args = item.args as Record<string, unknown>;
    if (Object.entries(args).some(([key, val]) => !allowed[tool].includes(key as keyof AgentArgs) ||
      (key === "duration" ? !Number.isInteger(val) || Number(val) < 5 || Number(val) > 720
        : typeof val !== "string" || val.length > (key === "notes" ? 500 : 200)))) return null;
    calls.push({ tool, args: args as AgentArgs });
  }
  return { message: row.message, explicit: row.explicit, calls };
}

const weekdays: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  "الأحد": 0, "الاحد": 0, "الاثنين": 1, "الإثنين": 1, "التلات": 2, "الثلاثاء": 2, "الأربعاء": 3, "الاربعاء": 3,
  "الخميس": 4, "الجمعة": 5, "السبت": 6 };
export function resolveDay(raw: string | undefined, today: string): string | null {
  const term = (raw ?? "today").trim().toLowerCase();
  if (validDate(term)) return term;
  if (["today", "النهاردة", "اليوم"].includes(term)) return today;
  if (["tomorrow", "بكرة", "غدا", "غداً"].includes(term)) return dateAdd(today, 1);
  if (["day after tomorrow", "بعد بكرة"].includes(term)) return dateAdd(today, 2);
  const day = term.replace(/^(next |يوم )/u, "").replace(/ الجاي$/u, "");
  const index = weekdays[day];
  if (index === undefined) return null;
  const delta = (index - weekday(today) + 7) % 7 || 7;
  return dateAdd(today, delta);
}

export function resolveTime(raw: string | undefined): string | null {
  if (!raw) return null;
  const normal = raw.replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).trim().toLowerCase();
  const match = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm|ص|م|صباحا|مساء|مساءً)?$/u.exec(normal);
  if (!match) return null;
  let hour = Number(match[1]); const minute = Number(match[2] ?? 0); const suffix = match[3];
  if (minute > 59 || hour > 23 || (suffix && (hour < 1 || hour > 12))) return null;
  // A bare "7" or "7:00" could be morning or evening. Ask instead of guessing.
  if (!suffix && hour <= 12 && !/^\d{2}:\d{2}$/.test(normal)) return null;
  if (["pm", "م", "مساء", "مساءً"].includes(suffix ?? "")) hour = hour % 12 + 12;
  if (["am", "ص", "صباحا"].includes(suffix ?? "")) hour %= 12;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function explicitCommand(message: string): boolean {
  return /\b(add|create|move|reschedule|change|set|mark|complete|edit|update|remind|cancel|delete)\b|(?:ضيف|ضف|حط|انقل|نقل|خلي|غير|علّم|كمل|خلص|فكرني|امسح|احذف)/iu.test(message);
}

/** A model's explicit flag is insufficient: the student's words must match the proposed domain. */
export function directToolCommand(call: AgentCall, message: string): boolean {
  if (!explicitCommand(message)) return false;
  const text = message.toLocaleLowerCase();
  const has = (pattern: RegExp) => pattern.test(text);
  switch (call.tool) {
    case "create_task": case "update_task": case "complete_task":
      return has(/\b(task|homework|assignment|to-do)\b|مهم[هة]|واجب|تاسك/u);
    case "create_block": case "move_block":
      return has(/\b(study|session|block|planner)\b|مذاكر|جلس[هة]|مخطط/u);
    case "create_reminder": case "edit_reminder":
      return has(/\b(remind|reminder)\b|فكرني|تذكير/u);
    case "set_goal": return has(/\bgoal\b|هدف/u);
    case "create_subject": case "update_subject": return has(/\bsubject\b|ماد[هة]/u);
    case "set_locale": return has(/\b(language|arabic|english)\b|لغ[هة]|عربي|انجليزي/u);
    case "set_theme": case "set_accent": return has(/\b(theme|accent|appearance|color)\b|مظهر|لون|ثيم/u);
    case "set_display_name": case "set_companion_name": return has(/\b(name|call you)\b|اسم|سمي/u);
    case "set_companion_enabled": case "set_auto_greeting": return has(/\b(companion|greeting)\b|رفيق|ترحيب/u);
    default: return false;
  }
}
