import "server-only";

import { focusStudent, getFocusProgress } from "@/features/focus/data";
import type { Progress } from "@/features/focus/logic";
import { getChallenges } from "@/features/challenges/data";
import { challengeViews, type ChallengeView } from "@/features/challenges/overview";
import { getAchievements } from "@/features/progression/data";
import { achievementViews, almostThere, type AchievementView } from "@/features/progression/achievement-view";
import { getCityDashboardProgress } from "@/features/city/data";
import { ownedRows, ownedTasks } from "@/features/planning/rows";
import { dateAdd, dayInZone, weekStart, type Subject, type Task } from "@/features/planning/logic";

export type DashboardData = {
  name: string;
  now: string;
  today: string;
  zone: string;
  goal: number;
  progress: Progress | null;
  activeFocus: "running" | "paused" | null | "unavailable";
  tasks: Task[] | null;
  subjects: Subject[] | null;
  challenges: ChallengeView[] | null;
  achievements: { unlocked: number; total: number; next: AchievementView | null } | null;
  city: Awaited<ReturnType<typeof getCityDashboardProgress>>;
};

/** Independent owner-scoped reads: one unavailable widget never hides the others. */
export async function dashboardData(): Promise<DashboardData> {
  const student = await focusStudent();
  const now = new Date().toISOString();
  const zone = student.settings.time_zone || "UTC";
  const today = dayInZone(now, zone);
  const first = weekStart(today);
  const [focus, tasks, subjects, challenges, achievements, city, activeFocus] = await Promise.allSettled([
    getFocusProgress(),
    ownedTasks(first, dateAdd(first, 6)),
    ownedRows("subjects"),
    getChallenges(),
    getAchievements(),
    getCityDashboardProgress(),
    student.client.from("focus_sessions").select("timer_state,updated_at")
      .eq("user_id", student.user.id).in("timer_state", ["running", "paused"]).limit(1),
  ] as const);

  let achievementSummary: DashboardData["achievements"] = null;
  if (achievements.status === "fulfilled" && achievements.value.kind === "authenticated") {
    try {
      const views = achievementViews(achievements.value.progress, achievements.value.unlocked);
      achievementSummary = {
        unlocked: views.filter(view => view.unlockedAt !== null).length,
        total: views.length,
        next: almostThere(views, 1)[0] ?? null,
      };
    } catch { /* Invalid evidence is unavailable, never fabricated progress. */ }
  }

  const focusRows = activeFocus.status === "fulfilled" && !activeFocus.value.error
    ? activeFocus.value.data : null;
  const activeState = focusRows === null ? "unavailable" as const
    : focusRows[0]?.timer_state === "paused" && Date.parse(focusRows[0].updated_at) < Date.parse(now) - 7 * 86400000
      ? null : focusRows[0]?.timer_state === "running" || focusRows[0]?.timer_state === "paused"
        ? focusRows[0].timer_state : null;
  const progress = focus.status === "fulfilled" && focus.value.today === today &&
    focus.value.weekStart === first ? focus.value : null;

  return {
    name: student.profile.display_name ?? "",
    now, today, zone,
    goal: student.profile.daily_goal_minutes ?? 120,
    progress,
    activeFocus: activeState,
    tasks: tasks.status === "fulfilled" ? tasks.value : null,
    subjects: subjects.status === "fulfilled" ? subjects.value : null,
    challenges: challenges.status === "fulfilled" && challenges.value.kind === "authenticated"
      ? challengeViews(challenges.value.challenges) : null,
    achievements: achievementSummary,
    city: city.status === "fulfilled" ? city.value : null,
  };
}
