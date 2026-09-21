import { planningData } from "@/features/planning/data";
import { progressData } from "@/features/focus/data";
import {
  ProgressHeading,
  GoalCard,
  QuickFocus,
  DashboardTasks,
  NextSession,
  WeeklyChart,
  StreakCard,
} from "@/features/focus/progress-ui";
import { dateAdd, filterTasks, occurrences } from "@/features/planning/logic";
export const dynamic = "force-dynamic";
export default async function Page() {
  const [data, stats] = await Promise.all([planningData(), progressData()]);
  const { progress, profile, settings } = stats;
  const tasks = filterTasks(
    data.tasks,
    "today",
    "",
    "",
    progress.today,
    progress.zone,
  ).slice(0, 5);
  const next =
    occurrences(
      data.blocks,
      progress.today,
      dateAdd(progress.today, 370),
      progress.zone,
    )
      .filter((x) => x.starts > data.now)
      .sort((a, b) => a.starts.localeCompare(b.starts))[0] ?? null;
  const hour = Number(
    new Intl.DateTimeFormat("en", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: progress.zone,
    }).format(new Date(data.now)),
  );
  return (
    <main id="main" className="study-main">
      <ProgressHeading name={profile.display_name ?? ""} hour={hour} />
      <div className="dashboard-grid">
        <GoalCard
          progress={progress}
          goal={profile.daily_goal_minutes ?? 120}
        />
        <QuickFocus minutes={settings.focus_minutes} />
        <DashboardTasks tasks={tasks} />
        <NextSession
          next={next}
          subjects={data.subjects}
          zone={progress.zone}
        />
        <WeeklyChart progress={progress} />
        <StreakCard streak={progress.streak} />
      </div>
    </main>
  );
}
