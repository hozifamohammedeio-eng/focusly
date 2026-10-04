import { dayInZone, occurrences } from "@/features/planning/logic";
import { resolveDay, resolveTime } from "./registry";
import type { AgentSnapshot, AgentTask, AgentSubject, AgentReminder, AgentBlock } from "./snapshot";

export type AgentRef = { kind: "task" | "subject" | "block" | "reminder"; id: string; title: string };
export type Match<T> = { kind: "found"; value: T } | { kind: "ambiguous"; choices: T[] } | { kind: "missing" };
const norm = (text: string) => text.toLocaleLowerCase().normalize("NFKC")
  .replace(/[\u064b-\u065f\u0670ـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي")
  .replace(/\s+/g, " ").trim();
export function choose<T extends { id: string; title?: string; name?: string }>(rows: T[], query: string | undefined,
  memory: AgentRef | null, kind: AgentRef["kind"]): Match<T> {
  const term = norm(query ?? "");
  if (!term || ["it", "that", "that one", "دي", "ده", "اللي قولنا عليها"].includes(term)) {
    if (memory?.kind === kind) {
      const value = rows.find(row => row.id === memory.id);
      return value ? { kind: "found", value } : { kind: "missing" };
    }
    return rows.length === 1 ? { kind: "found", value: rows[0]! } : rows.length > 1
      ? { kind: "ambiguous", choices: rows.slice(0, 5) } : { kind: "missing" };
  }
  const exact = rows.filter(row => norm(row.title ?? row.name ?? "") === term);
  const matches = exact.length ? exact : rows.filter(row => norm(row.title ?? row.name ?? "").includes(term));
  return matches.length === 1 ? { kind: "found", value: matches[0]! } : matches.length > 1
    ? { kind: "ambiguous", choices: matches.slice(0, 5) } : { kind: "missing" };
}

export function taskMatch(snapshot: AgentSnapshot, query: string | undefined, dayRaw: string | undefined,
  memory: AgentRef | null): Match<AgentTask> {
  const day = dayRaw ? resolveDay(dayRaw, snapshot.today) : null;
  if (dayRaw && !day) return { kind: "missing" };
  const rows = snapshot.tasks.filter(task => !day || task.day === day);
  return choose(rows, query, memory, "task");
}
export function subjectMatch(snapshot: AgentSnapshot, query: string | undefined, memory: AgentRef | null): Match<AgentSubject> {
  return choose(snapshot.subjects.filter(subject => !subject.archived), query, memory, "subject");
}
export function reminderMatch(snapshot: AgentSnapshot, query: string | undefined, memory: AgentRef | null): Match<AgentReminder> {
  return choose(snapshot.reminders, query, memory, "reminder");
}
export function blockMatch(snapshot: AgentSnapshot, query: string | undefined, dayRaw: string | undefined,
  timeRaw: string | undefined, memory: AgentRef | null): Match<AgentBlock> {
  const day = dayRaw ? resolveDay(dayRaw, snapshot.today) : null;
  const time = timeRaw ? resolveTime(timeRaw) : null;
  if (dayRaw && !day || timeRaw && !time) return { kind: "missing" };
  const rows = snapshot.blocks.filter(block => {
    if (!day && !time) return true;
    const days = day ? [day] : [snapshot.today];
    return days.some(value => occurrences([block], value, value, snapshot.zone).some(event =>
      (!time || new Intl.DateTimeFormat("en-GB", { timeZone: snapshot.zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
        .format(new Date(event.starts)) === time) && (!day || dayInZone(event.starts, snapshot.zone) === day)));
  });
  return choose(rows, query, memory, "block");
}

export function refFor(kind: AgentRef["kind"], row: { id: string; title?: string; name?: string }): AgentRef {
  return { kind, id: row.id, title: row.title ?? row.name ?? "" };
}
