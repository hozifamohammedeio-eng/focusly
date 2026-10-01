import type { Database } from "../../types/database.ts";
export type Subject = Database["public"]["Tables"]["subjects"]["Row"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type Block = Database["public"]["Tables"]["study_blocks"]["Row"];
export type Occurrence = { block: Block; starts: string; ends: string };
export type View =
  | "home"
  | "tasks"
  | "subjects"
  | "planner"
  | "calendar"
  | "settings";
export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validText(value: string, max: number) {
  return (
    value.trim().length >= 1 &&
    value.trim().length <= max &&
    !/[\x00-\x1f\x7f]/.test(value)
  );
}
export function validSubject(name: string, color: string) {
  return validText(name, 80) && /^#[0-9a-f]{6}$/i.test(color);
}
export function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number(value.slice(0, 4)) >= 1900 &&
    Number(value.slice(0, 4)) <= 9999 &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value
  );
}
export function dateAdd(day: string, amount: number) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}
export function weekday(day: string) {
  return new Date(day + "T12:00:00Z").getUTCDay();
}
export function weekStart(day: string) {
  return dateAdd(day, -((weekday(day) + 1) % 7));
}
export function monthStart(day: string) {
  return day.slice(0, 8) + "01";
}
export function monthMove(day: string, delta: number) {
  const d = new Date(monthStart(day) + "T12:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toISOString().slice(0, 10);
}
export function validZone(zone: string) {
  try {
    dateFormatter("en", { timeZone: zone }).format();
    return zone.length <= 100;
  } catch {
    return false;
  }
}
// Formatters contain no user data. Bound the cache for user-entered time zones.
const formatters = new Map<string, Intl.DateTimeFormat>();
function dateFormatter(locale: string, options: Intl.DateTimeFormatOptions) {
  const key = JSON.stringify([locale, options]);
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    if (formatters.size >= 64) formatters.delete(formatters.keys().next().value!);
    formatters.set(key, formatter);
  }
  return formatter;
}
function parts(instant: string | number, zone: string) {
  const p = dateFormatter("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instant));
  const value = (key: string) => p.find((x) => x.type === key)!.value;
  return {
    day: `${value("year")}-${value("month")}-${value("day")}`,
    time: `${value("hour")}:${value("minute")}`,
  };
}
export const localParts = parts;
export function dayInZone(instant: string | number, zone: string) {
  return parts(instant, zone).day;
}
// Resolve a wall-clock date/time without interpreting a date-only value as UTC.
// DST gaps are rejected; a repeated time resolves to its earlier occurrence.
export function toInstant(
  day: string,
  time: string,
  zone: string,
): string | null {
  if (
    !validDate(day) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ||
    !validZone(zone)
  )
    return null;
  const base = Date.parse(day + "T" + time + ":00Z");
  const candidates = new Set<number>();
  for (const offset of [-86400000, 0, 86400000]) {
    const sample = base + offset,
      p = parts(sample, zone);
    const delta = Date.parse(p.day + "T" + p.time + ":00Z") - sample;
    candidates.add(base - delta);
  }
  const matches = [...candidates]
    .filter((x) => {
      const p = parts(x, zone);
      return p.day === day && p.time === time;
    })
    .sort((a, b) => a - b);
  return matches[0] === undefined ? null : new Date(matches[0]).toISOString();
}
export function formatDay(
  day: string,
  locale: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
) {
  return dateFormatter(locale, {
    ...options,
    timeZone: "UTC",
  }).format(new Date(day + "T12:00:00Z"));
}
export function formatTime(instant: string, locale: string, zone: string) {
  return dateFormatter(locale, {
    timeZone: zone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(instant));
}
export function formatRange(from: string, to: string, locale: string) {
  return dateFormatter(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).formatRange(new Date(from + "T12:00:00Z"), new Date(to + "T12:00:00Z"))
    // ICU versions in Node and browsers differ in range separator spacing.
    .replace(/[\u00a0\u2009\u202f]/g, " ");
}
export function taskDay(task: Task, zone: string) {
  void zone; // Calendar day is stored; a later timezone change must not move it.
  return task.task_date;
}
export function filterTasks(
  tasks: Task[],
  filter: string,
  subject: string,
  priority: string,
  today: string,
  zone: string,
) {
  return tasks
    .filter((t) => {
      const day = taskDay(t, zone);
      return (
        (!subject || t.subject_id === subject) &&
        (!priority || t.priority === priority) &&
        (filter === "completed"
          ? t.status === "completed"
          : filter === "today"
            ? t.status !== "completed" && day === today
            : filter === "upcoming"
              ? t.status !== "completed" && !!day && day > today
              : true)
      );
    })
    .sort((a, b) => {
      const completed =
        Number(a.status === "completed") - Number(b.status === "completed");
      if (completed) return completed;
      const ad = taskDay(a, zone),
        bd = taskDay(b, zone);
      if (!ad && bd) return 1;
      if (ad && !bd) return -1;
      return (
        (ad || "").localeCompare(bd || "") ||
        (a.due_at || "").localeCompare(b.due_at || "") ||
        a.created_at.localeCompare(b.created_at) ||
        a.id.localeCompare(b.id)
      );
    });
}
export function validTask(input: {
  title: string;
  notes: string;
  priority: string;
  due_on: string | null;
  due_at: string | null;
}) {
  return (
    validText(input.title, 200) &&
    input.notes.length <= 5000 &&
    ["low", "medium", "high"].includes(input.priority) &&
    !(input.due_on && input.due_at) &&
    (!input.due_on || validDate(input.due_on)) &&
    (!input.due_at || Number.isFinite(Date.parse(input.due_at)))
  );
}
export function occurrences(
  blocks: Block[],
  from: string,
  to: string,
  viewZone: string,
): Occurrence[] {
  const result: Occurrence[] = [];
  for (const block of blocks) {
    const start = Date.parse(block.starts_at),
      duration = Date.parse(block.ends_at) - start;
    if (!block.repeat_weekly) {
      const day = dayInZone(start, viewZone);
      if (day >= from && day <= to)
        result.push({ block, starts: block.starts_at, ends: block.ends_at });
      continue;
    }
    const anchor = parts(start, block.time_zone);
    const weeks = Math.max(
      0,
      Math.floor((Date.parse(from) - Date.parse(anchor.day)) / 604800000) - 1,
    );
    for (let i = weeks; i < weeks + 60; i++) {
      const day = dateAdd(anchor.day, i * 7);
      if (day > dateAdd(to, 2)) break;
      const instant = toInstant(day, anchor.time, block.time_zone);
      if (!instant) continue;
      const localDay = dayInZone(instant, viewZone);
      if (localDay >= from && localDay <= to)
        result.push({
          block,
          starts: instant,
          ends: new Date(Date.parse(instant) + duration).toISOString(),
        });
    }
  }
  return result.sort(
    (a, b) =>
      a.starts.localeCompare(b.starts) || a.block.id.localeCompare(b.block.id),
  );
}
export function overlaps(candidate: Block, others: Block[]) {
  const zone = candidate.time_zone;
  return others
    .filter((x) => x.id !== candidate.id)
    .some((other) => {
      const start = dayInZone(
        Math.max(Date.parse(candidate.starts_at), Date.parse(other.starts_at)),
        zone,
      );
      const end = dateAdd(
        start,
        candidate.repeat_weekly && other.repeat_weekly ? 370 : 1,
      );
      const a = occurrences([candidate], dateAdd(start, -1), end, zone),
        b = occurrences([other], dateAdd(start, -1), end, zone);
      return a.some((x) =>
        b.some(
          (y) =>
            Date.parse(x.starts) < Date.parse(y.ends) &&
            Date.parse(y.starts) < Date.parse(x.ends),
        ),
      );
    });
}
