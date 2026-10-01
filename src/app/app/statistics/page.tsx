import { progressData } from "@/features/focus/data";
import { WeeklyAiReport } from "@/features/focus/weekly-ai-report";
import { StatisticsExperience } from "./statistics-experience";

export default async function Page() {
  const { progress, subjects, settings } =
    await progressData();

  return (
    <main id="main" className="study-main">
      <StatisticsExperience progress={progress} subjects={subjects} />
      {progress.totalSessions > 0 && <WeeklyAiReport
        locale={
          settings.locale === "ar"
            ? "ar"
            : "en"
        }
      />}

    </main>
  );
}
