import { cache } from "react";
import { redirect } from "next/navigation";
import { getStudent } from "@/features/auth/session";
import { ownedRows, ownedTasks } from "./rows";
import { dateAdd, dayInZone, monthStart, validDate, weekStart } from "./logic";
export const planningData = cache(async (view: "all" | "subjects" | "tasks" | "planner" | "calendar" | "focus" = "all", requestedDay?: string) => {
  const student = await getStudent();
  if (student.kind === "anonymous" || student.kind === "unconfigured")
    redirect("/login");
  if (student.kind !== "authenticated")
    throw new Error("Study workspace unavailable");
  if (!student.profile.onboarding_completed) redirect("/onboarding");
  const now = new Date().toISOString();
  const zone = student.settings.time_zone || "UTC";
  const today = dayInZone(now, zone);
  const selectedDay = requestedDay && validDate(requestedDay) ? requestedDay : today;
  const from = view === "planner" ? weekStart(selectedDay)
    : view === "calendar" ? weekStart(monthStart(selectedDay)) : selectedDay;
  const to = view === "planner" ? dateAdd(from, 6)
    : view === "calendar" ? dateAdd(from, 41) : from;
  const [subjects, tasks, blocks] = await Promise.all([
    ownedRows("subjects"),
    view === "subjects" ? Promise.resolve([]) : ownedTasks(from, to),
    view === "subjects" || view === "tasks" || view === "focus" ? Promise.resolve([]) : ownedRows("study_blocks"),
  ]);
  return {
    profile: student.profile,
    settings: student.settings,
    email: student.user.email ?? "",
    subjects,
    tasks,
    blocks,
    now,
    selectedDay,
    zone,
  };
});
export type PlanningData = Awaited<ReturnType<typeof planningData>>;
