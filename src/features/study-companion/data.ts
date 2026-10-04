import "server-only";
import { getStudent } from "@/features/auth/session";
import { dateAdd, dayInZone, occurrences, toInstant, validZone } from "@/features/planning/logic";
import type { Progress } from "@/features/focus/logic";
import type { CompanionContext, CompanionPreference, CompanionTask } from "./model";

export async function companionStudent() {
  const student = await getStudent();
  if (student.kind !== "authenticated" || !student.profile.onboarding_completed) return null;
  return student;
}

export async function ownedPreferences(): Promise<{ owner: string; preference: CompanionPreference | null } | null> {
  const student = await companionStudent();
  if (!student) return null;
  const result = await student.client.from("study_companion_preferences")
    .select("companion_name,enabled,auto_greeting_enabled").eq("user_id", student.user.id).maybeSingle();
  if (result.error) throw new Error("Companion preferences unavailable");
  return { owner: student.user.id, preference: result.data };
}

export async function ownedContext(): Promise<CompanionContext | null> {
  const student = await companionStudent();
  if (!student) return null;
  const owner = student.user.id;
  const zone = student.settings.time_zone || "UTC";
  if (!validZone(zone)) return null;
  const now = new Date().toISOString();
  const today = dayInZone(now, zone);
  const tomorrow = dateAdd(today, 1);
  const start = toInstant(today, "00:00", zone) ?? new Date(Date.parse(now) - 86400000).toISOString();
  const [tasks, subjects, oneOff, repeat, schedule, progress] = await Promise.all([
    student.client.from("tasks").select("id,title,subject_id,priority,task_date,estimated_minutes")
      .eq("user_id", owner).neq("status", "completed").lte("task_date", tomorrow)
      .order("task_date").order("created_at").limit(40),
    student.client.from("subjects").select("id,name").eq("user_id", owner).is("archived_at", null).limit(80),
    student.client.from("study_blocks").select("*").eq("user_id", owner).eq("repeat_weekly", false)
      .gte("ends_at", start).lte("starts_at", new Date(Date.parse(now) + 2 * 86400000).toISOString()).limit(100),
    student.client.from("study_blocks").select("*").eq("user_id", owner).eq("repeat_weekly", true).limit(100),
    student.client.from("study_schedule_items").select("title,weekday,local_time,time_zone")
      .eq("user_id", owner).eq("enabled", true).limit(60),
    student.client.rpc("focus_progress"),
  ]);
  if (tasks.error || subjects.error || oneOff.error || repeat.error || schedule.error) throw new Error("Companion context unavailable");
  const names = new Map(subjects.data.map(subject => [subject.id, subject.name]));
  const ownedTasks: CompanionTask[] = tasks.data.map(task => ({
    id: task.id, title: task.title, subjectId: task.subject_id,
    subjectName: task.subject_id ? names.get(task.subject_id) ?? null : null,
    day: task.task_date, priority: task.priority, estimatedMinutes: task.estimated_minutes,
  }));
  const blocks = occurrences([...oneOff.data, ...repeat.data], today, today, zone)
    .map(event => ({ startsAt: event.starts, endsAt: event.ends, title: event.block.title }));
  const upcomingSchedule = schedule.data.flatMap(item => {
    if (!item.local_time || !validZone(item.time_zone)) return [];
    const scheduleDay = dayInZone(now, item.time_zone);
    if (new Date(scheduleDay + "T12:00:00Z").getUTCDay() !== item.weekday) return [];
    const startsAt = toInstant(scheduleDay, item.local_time.slice(0, 5), item.time_zone);
    return startsAt ? [{ startsAt, endsAt: new Date(Date.parse(startsAt) + 60 * 60000).toISOString(), title: item.title }] : [];
  });
  const upcoming = [...blocks, ...upcomingSchedule].filter(item => Date.parse(item.startsAt) > Date.parse(now))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0] ?? null;
  const value = progress.error ? null : progress.data as unknown as Progress | null;
  const studiedMinutes = value?.today === today
    ? Math.floor((value.days.find(day => day.day === today)?.seconds ?? 0) / 60) : null;
  return { now, today, zone, goalMinutes: student.profile.daily_goal_minutes ?? 120,
    studiedMinutes, tasks: ownedTasks, blocks: [...blocks, ...upcomingSchedule], upcoming };
}
