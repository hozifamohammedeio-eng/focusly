import { focusStudent, progressData } from "@/features/focus/data";
import { planningData } from "@/features/planning/data";
import { FocusTimer } from "@/features/focus/timer";
export default async function Page() {
  const [student, data, stats] = await Promise.all([
    focusStudent(),
    planningData("focus"),
    progressData(),
  ]);
  return (
    <FocusTimer
      key={student.user.id}
      userId={student.user.id}
      settings={student.settings}
      subjects={data.subjects}
      tasks={data.tasks}
      progress={stats.progress}
      goal={student.profile.daily_goal_minutes ?? 120}
    />
  );
}
