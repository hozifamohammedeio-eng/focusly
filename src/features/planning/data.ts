import { cache } from "react";
import { redirect } from "next/navigation";
import { getStudent } from "@/features/auth/session";
import { ownedRows } from "./rows";
export const planningData = cache(async (view: "all" | "subjects" | "tasks" | "planner" | "calendar" | "focus" = "all") => {
  const student = await getStudent();
  if (student.kind === "anonymous" || student.kind === "unconfigured")
    redirect("/login");
  if (student.kind !== "authenticated")
    throw new Error("Study workspace unavailable");
  if (!student.profile.onboarding_completed) redirect("/onboarding");
  const [subjects, tasks, blocks] = await Promise.all([
    ownedRows("subjects"),
    view === "subjects" || view === "planner" ? Promise.resolve([]) : ownedRows("tasks"),
    view === "subjects" || view === "tasks" || view === "focus" ? Promise.resolve([]) : ownedRows("study_blocks"),
  ]);
  return {
    profile: student.profile,
    settings: student.settings,
    email: student.user.email ?? "",
    subjects,
    tasks,
    blocks,
    now: new Date().toISOString(),
  };
});
export type PlanningData = Awaited<ReturnType<typeof planningData>>;
