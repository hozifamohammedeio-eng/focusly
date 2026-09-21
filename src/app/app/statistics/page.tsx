import { progressData } from "@/features/focus/data";
import {
  ProgressHeading,
  StatsSummary,
  WeeklyChart,
  SubjectStats,
  History,
} from "@/features/focus/progress-ui";
export default async function Page() {
  const { progress, subjects } = await progressData();
  return (
    <main id="main" className="study-main">
      <ProgressHeading statistics />
      <StatsSummary progress={progress} />
      <div className="mt-6 grid gap-5">
        <WeeklyChart progress={progress} />
        <div className="grid gap-5 lg:grid-cols-2">
          <SubjectStats progress={progress} subjects={subjects} />
          <History progress={progress} subjects={subjects} />
        </div>
      </div>
    </main>
  );
}
