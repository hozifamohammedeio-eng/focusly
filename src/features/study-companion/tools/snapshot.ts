import "server-only";
import { dateAdd, dayInZone, occurrences, toInstant, validZone, weekday, type Block } from "@/features/planning/logic";
import { companionStudent } from "../data";

export type Student = NonNullable<Awaited<ReturnType<typeof companionStudent>>>;
export type AgentTask = { id: string; title: string; day: string; subjectId: string | null; priority: "low" | "medium" | "high";
  notes: string | null; status: "todo" | "in_progress" | "completed"; dueAt: string | null };
export type AgentSubject = { id: string; name: string; color: string; archived: boolean };
export type AgentBlock = Block;
export type AgentSchedule = { title: string; weekday: number; time: string | null; zone: string };
export type AgentReminder = { id: string; title: string; remindAt: string; status: "scheduled" | "delivered" | "cancelled" };
export type AgentSnapshot = { owner: string; today: string; now: string; zone: string; goal: number;
  displayName: string | null; locale: "en" | "ar"; theme: "light" | "dark" | "system";
  accent: "violet" | "blue" | "green" | "orange"; companionName: string;
  companionEnabled: boolean; autoGreetingEnabled: boolean;
  tasks: AgentTask[]; subjects: AgentSubject[]; blocks: AgentBlock[]; schedule: AgentSchedule[];
  reminders: AgentReminder[]; focusMinutesToday: number | null; activeFocus: { state: string; taskId: string | null } | null };

/** All returned rows are owner-scoped; the model never receives a full database dump. */
export async function loadAgentSnapshot(student: Student): Promise<AgentSnapshot> {
  const owner = student.user.id;
  const zone = student.settings.time_zone || "UTC";
  if (!validZone(zone)) throw new Error("Invalid saved timezone");
  const now = new Date().toISOString();
  const today = dayInZone(now, zone);
  const from = dateAdd(today, -7), to = dateAdd(today, 14);
  const [tasks, subjects, oneOff, recurring, schedule, reminders] = await Promise.all([
    student.client.from("tasks").select("id,title,task_date,subject_id,priority,notes,status,due_at")
      .eq("user_id", owner).gte("task_date", from).lte("task_date", to).order("task_date").limit(100),
    student.client.from("subjects").select("id,name,color,archived_at").eq("user_id", owner).limit(100),
    student.client.from("study_blocks").select("*").eq("user_id", owner).eq("repeat_weekly", false)
      .gte("ends_at", `${from}T00:00:00Z`).lte("starts_at", `${dateAdd(to, 2)}T00:00:00Z`).limit(150),
    student.client.from("study_blocks").select("*").eq("user_id", owner).eq("repeat_weekly", true).limit(150),
    student.client.from("study_schedule_items").select("title,weekday,local_time,time_zone")
      .eq("user_id", owner).eq("enabled", true).limit(70),
    student.client.from("study_reminders").select("id,title,remind_at,status")
      .eq("user_id", owner).eq("status", "scheduled").gte("remind_at", now).order("remind_at").limit(30),
  ]);
  if (tasks.error || subjects.error || oneOff.error || recurring.error || schedule.error || reminders.error) throw new Error("Agent context unavailable");
  return {
    owner, today, now, zone, goal: student.profile.daily_goal_minutes ?? 120,
    displayName: student.profile.display_name, locale: student.settings.locale, theme: student.settings.theme,
    accent: student.settings.accent, companionName: "", companionEnabled: true, autoGreetingEnabled: true,
    tasks: tasks.data.map(row => ({ id: row.id, title: row.title, day: row.task_date, subjectId: row.subject_id,
      priority: row.priority, notes: row.notes, status: row.status, dueAt: row.due_at })),
    subjects: subjects.data.map(row => ({ id: row.id, name: row.name, color: row.color, archived: !!row.archived_at })),
    blocks: [...oneOff.data, ...recurring.data], schedule: schedule.data.map(row => ({ title: row.title, weekday: row.weekday,
      time: row.local_time, zone: row.time_zone })),
    reminders: reminders.data.map(row => ({ id: row.id, title: row.title, remindAt: row.remind_at, status: row.status })),
    focusMinutesToday: null,
    activeFocus: null,
  };
}

export function dayEvents(snapshot: AgentSnapshot, day: string) {
  const taskRows = snapshot.tasks.filter(task => task.day === day);
  const blockRows = occurrences(snapshot.blocks, day, day, snapshot.zone);
  const lessonRows = snapshot.schedule.flatMap(item => {
    if (!item.time || !validZone(item.zone)) return [];
    return [-1, 0, 1].flatMap(offset => {
      const localDay = dateAdd(day, offset);
      if (weekday(localDay) !== item.weekday) return [];
      const start = toInstant(localDay, item.time!.slice(0, 5), item.zone);
      return start && dayInZone(start, snapshot.zone) === day
        ? [{ title: item.title, starts: start, ends: new Date(Date.parse(start) + 3600000).toISOString() }] : [];
    });
  });
  return { tasks: taskRows, blocks: blockRows, lessons: lessonRows };
}
