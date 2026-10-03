import { dateAdd, toInstant, validDate, weekStart, type Block } from "@/features/planning/logic";

export type Locale = "en" | "ar";
export type WorkType = "lecture" | "revision" | "homework" | "practice" | "reading" | "project" | "other";
export type Priority = "low" | "medium" | "high";
export type Preference = "morning" | "afternoon" | "evening" | "flexible";
export type Style = "balanced" | "light" | "productive" | "catchup";
export type FixedEvent = { id: string; subjectId: string; title: string; date: string; start: string; end: string; notes: string };
export type PlannerInput = {
  weekStart: string; zone: string; locale: Locale;
  workload: Record<string, string>; backlog: string; exams: string;
  fixed: FixedEvent[]; dailyMinutes: number; preferred: Preference;
  sessionMinutes: 25 | 45 | 60 | 90; daysOff: string[]; busyDays: string[];
  prioritySubjects: string[]; style: Style;
};
export type WorkItem = {
  id: string; subjectId: string; title: string; type: WorkType;
  estimatedMinutes: number; priority: Priority; isBacklog: boolean; deadline: string | null;
};
export type PlanSession = {
  id: string; workItemId: string; subjectId: string; title: string; date: string;
  start: string; end: string; type: WorkType;
};
export type GeneratedPlan = { items: WorkItem[]; sessions: PlanSession[]; summary: string; reasoning: string[] };
export type Validation = { ok: true; plan: GeneratedPlan } | { ok: false; reason: string };
const uuid = /^[a-zA-Z0-9_-]{1,50}$/;
const time = /^([01]\d|2[0-3]):[0-5]\d$/;
const types: WorkType[] = ["lecture", "revision", "homework", "practice", "reading", "project", "other"];
const priorities: Priority[] = ["low", "medium", "high"];
const preferences: Preference[] = ["morning", "afternoon", "evening", "flexible"];
const styles: Style[] = ["balanced", "light", "productive", "catchup"];
const text = (value: unknown, max: number): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= max && !/[\x00-\x08\x0e-\x1f]/.test(value);
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const minutes = (start: string, end: string) => {
  if (!time.test(start) || !time.test(end)) return -1;
  return (Number(end.slice(0, 2)) * 60 + Number(end.slice(3))) - (Number(start.slice(0, 2)) * 60 + Number(start.slice(3)));
};
export function validateInput(input: unknown, subjectIds: Set<string>): input is PlannerInput {
  if (!record(input) || !validDate(String(input.weekStart)) || weekStart(String(input.weekStart)) !== input.weekStart ||
    !["ar", "en"].includes(String(input.locale)) || !text(input.zone, 100) ||
    !Number.isInteger(input.dailyMinutes) || Number(input.dailyMinutes) < 30 || Number(input.dailyMinutes) > 480 ||
    !preferences.includes(input.preferred as Preference) || ![25, 45, 60, 90].includes(Number(input.sessionMinutes)) ||
    !styles.includes(input.style as Style) || !record(input.workload) ||
    (input.backlog !== "" && !text(input.backlog, 2000)) || (input.exams !== "" && !text(input.exams, 1000)) ||
    !Array.isArray(input.fixed) || input.fixed.length > 20 ||
    !Array.isArray(input.daysOff) || !Array.isArray(input.busyDays) || !Array.isArray(input.prioritySubjects)) return false;
  const days = new Set(Array.from({ length: 7 }, (_, i) => dateAdd(input.weekStart as string, i)));
  if (Object.entries(input.workload).length > 30 || Object.entries(input.workload).some(([id, value]) => !subjectIds.has(id) || typeof value !== "string" || value.length > 2000)) return false;
  if ([input.daysOff, input.busyDays].some(list => list.length > 7 || list.some(day => typeof day !== "string" || !days.has(day))) ||
    input.prioritySubjects.length > subjectIds.size || input.prioritySubjects.some(id => !subjectIds.has(id))) return false;
  return input.fixed.every(event => record(event) && uuid.test(String(event.id)) && subjectIds.has(String(event.subjectId)) &&
    text(event.title, 200) && days.has(String(event.date)) && minutes(String(event.start), String(event.end)) >= 5 &&
    minutes(String(event.start), String(event.end)) <= 720 && typeof event.notes === "string" && event.notes.length <= 1000 &&
    !!toInstant(event.date as string, event.start as string, input.zone as string) && !!toInstant(event.date as string, event.end as string, input.zone as string));
}
export function hasWorkload(input: PlannerInput) {
  return Object.values(input.workload).some(value => value.trim()) || !!input.backlog.trim() || input.fixed.length > 0;
}
export function parsePlan(value: unknown): GeneratedPlan | null {
  if (!record(value) || !Array.isArray(value.items) || !Array.isArray(value.sessions) || !text(value.summary, 500) ||
    !Array.isArray(value.reasoning) || value.reasoning.length > 5 || value.reasoning.some(x => !text(x, 300)) ||
    value.items.length > 50 || value.sessions.length > 70) return null;
  for (const item of value.items) if (!record(item) || !uuid.test(String(item.id)) || typeof item.subjectId !== "string" ||
    !text(item.title, 200) || !types.includes(item.type as WorkType) ||
    !Number.isInteger(item.estimatedMinutes) || Number(item.estimatedMinutes) < 5 || Number(item.estimatedMinutes) > 480 ||
    !priorities.includes(item.priority as Priority) || typeof item.isBacklog !== "boolean" ||
    !(item.deadline === null || typeof item.deadline === "string" && validDate(item.deadline))) return null;
  for (const session of value.sessions) if (!record(session) || !uuid.test(String(session.id)) || !uuid.test(String(session.workItemId)) ||
    typeof session.subjectId !== "string" || !text(session.title, 200) || !validDate(String(session.date)) ||
    !time.test(String(session.start)) || !time.test(String(session.end)) || !types.includes(session.type as WorkType)) return null;
  return value as GeneratedPlan;
}
export function validatePlan(plan: GeneratedPlan, input: PlannerInput, subjectIds: Set<string>, existing: Block[]): Validation {
  if (!validateInput(input, subjectIds)) return { ok: false, reason: "input" };
  const ids = new Set<string>();
  const items = new Map<string, WorkItem>();
  for (const item of plan.items) {
    if (ids.has(item.id) || !subjectIds.has(item.subjectId)) return { ok: false, reason: "item" };
    ids.add(item.id); items.set(item.id, item);
  }
  ids.clear();
  const intervals: { start: number; end: number }[] = [];
  const totals = new Map<string, number>();
  const expectedDays = new Set(Array.from({ length: 7 }, (_, i) => dateAdd(input.weekStart, i)));
  for (const block of existing) {
    // Existing weekly recurrences are expanded by the shared Planner logic before calling this validator.
    intervals.push({ start: Date.parse(block.starts_at), end: Date.parse(block.ends_at) });
  }
  const fixedIds = new Set<string>();
  for (const event of input.fixed) {
    const start = toInstant(event.date, event.start, input.zone), end = toInstant(event.date, event.end, input.zone);
    if (!start || !end || fixedIds.has(event.id) || Date.parse(end) <= Date.parse(start)) return { ok: false, reason: "fixed" };
    fixedIds.add(event.id);
    if (intervals.some(other => Date.parse(start) < other.end && other.start < Date.parse(end))) return { ok: false, reason: "overlap" };
    intervals.push({ start: Date.parse(start), end: Date.parse(end) });
  }
  for (const session of plan.sessions) {
    const item = items.get(session.workItemId);
    if (ids.has(session.id) || !item || item.subjectId !== session.subjectId || !subjectIds.has(session.subjectId) ||
      !expectedDays.has(session.date) || input.daysOff.includes(session.date)) return { ok: false, reason: "session" };
    ids.add(session.id);
    const start = toInstant(session.date, session.start, input.zone), end = toInstant(session.date, session.end, input.zone);
    if (!start || !end) return { ok: false, reason: "time" };
    const a = Date.parse(start), b = Date.parse(end), duration = (b - a) / 60000;
    if (duration < 5 || duration > 120 || !Number.isInteger(duration)) return { ok: false, reason: "duration" };
    if (intervals.some(other => a < other.end && other.start < b)) return { ok: false, reason: "overlap" };
    intervals.push({ start: a, end: b });
    totals.set(session.date, (totals.get(session.date) ?? 0) + duration);
    if ((totals.get(session.date) ?? 0) > input.dailyMinutes) return { ok: false, reason: "capacity" };
  }
  if (plan.items.some(item => {
    const scheduled = plan.sessions.filter(session => session.workItemId === item.id)
      .reduce((sum, session) => sum + minutes(session.start, session.end), 0);
    return scheduled < item.estimatedMinutes || scheduled > item.estimatedMinutes + input.sessionMinutes;
  })) return { ok: false, reason: "unscheduled" };
  return { ok: true, plan };
}
