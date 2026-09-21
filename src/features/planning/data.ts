import { cache } from "react";
import { redirect } from "next/navigation";
import { getStudent } from "@/features/auth/session";
import type { Database } from "@/types/database";
export const planningData = cache(async () => {
  const student = await getStudent();
  if (student.kind === "anonymous" || student.kind === "unconfigured")
    redirect("/login");
  if (student.kind !== "authenticated")
    throw new Error("Study workspace unavailable");
  if (!student.profile.onboarding_completed) redirect("/onboarding");
  const { client, user } = student;
  // Fetch all pages intentionally; never silently truncate at PostgREST's row cap.
  async function rows<T extends "subjects" | "tasks" | "study_blocks">(
    table: T,
  ) {
    const items = [];
    for (let page = 0; ; page++) {
      const result = await client
        .from(table as "subjects" | "tasks" | "study_blocks")
        .select("*")
        .eq("user_id", user.id)
        .order("id")
        .range(page * 500, page * 500 + 499);
      if (result.error) {
        console.error("planning_read_failed", {
          table,
          code: result.error.code,
        });
        throw new Error("Study workspace unavailable");
      }
      items.push(...result.data);
      if (result.data.length < 500) break;
    }
    return items as Database["public"]["Tables"][T]["Row"][];
  }
  const [subjects, tasks, blocks] = await Promise.all([
    rows("subjects"),
    rows("tasks"),
    rows("study_blocks"),
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
