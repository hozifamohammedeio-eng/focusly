import { challengeCatalog } from "@/features/challenges/catalog";
import { nextChallenge, type ChallengeView } from "@/features/challenges/overview";
import { todaySeconds, weekDays, weekSeconds, type Progress } from "@/features/focus/logic";
import { filterTasks, taskDay, type Task } from "@/features/planning/logic";

/** The Tasks page owns these same rows and uses filterTasks for its Today view. */
export function dashboardTodayTasks(tasks: readonly Task[], today: string, zone: string) {
  return filterTasks([...tasks], "all", "", "", today, zone)
    .filter(task => taskDay(task, zone) === today);
}

export function dashboardChallengePeriod(views: readonly ChallengeView[] | null, kind: "daily" | "weekly") {
  if (!views) return null;
  const items = views.filter(view => challengeCatalog.find(entry => entry.key === view.key)?.kind === kind);
  const active = items.filter(view => view.current !== null);
  return {
    items,
    completed: active.filter(view => view.state === "completed").length,
    total: items.length,
    available: active.length === items.length,
    percent: active.length === items.length
      ? Math.round(active.reduce((sum, view) => sum + (view.percent ?? 0), 0) / items.length) : null,
    next: nextChallenge(items, kind),
  };
}

export function dashboardFocusWeek(progress: Progress) {
  const days = weekDays(progress);
  return {
    todaySeconds: todaySeconds(progress),
    weekSeconds: weekSeconds(progress),
    studyDays: days.filter(day => day.seconds > 0).length,
    days,
    streak: progress.streak,
  };
}
