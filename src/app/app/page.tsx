import { planningData } from "@/features/planning/data";
import { progressData } from "@/features/focus/data";
import { getChallenges } from "@/features/challenges/data";
import { DailyChallengesWidget } from "@/features/challenges/summary";

import {
  ProgressHeading,
  GoalCard,
  QuickFocus,
  DashboardTasks,
  NextSession,
  WeeklyChart,
  StreakCard,
} from "@/features/focus/progress-ui";

import { Card } from "@/components/ui/card";

import {
  dateAdd,
  filterTasks,
  occurrences,
} from "@/features/planning/logic";

export const dynamic = "force-dynamic";

const DAILY_MOTIVATION = {
  ar: [
    "ابدأ بالقليل، والاستمرار سيصنع الفرق.",
    "ساعة مركزة اليوم أفضل من خطة مثالية لم تبدأ.",
    "كل جلسة مذاكرة تقرّبك خطوة من هدفك.",
    "ركز على المهمة التي أمامك الآن، والباقي يأتي بعد ذلك.",
    "التقدم الهادئ ما زال تقدمًا.",
    "لا تحتاج إلى إنجاز كل شيء اليوم، فقط ابدأ بالأهم.",
    "اجعل هدف اليوم واضحًا، ثم ابدأ.",
    "الاستمرارية أقوى من الحماس المؤقت.",
    "مجهود صغير ومتكرر يصنع نتيجة كبيرة.",
    "ابدأ حتى لو لم تشعر أنك مستعد تمامًا.",
    "كل خطوة صغيرة اليوم تسهّل عليك الغد.",
    "مهمتك ليست أن تكون مثاليًا، بل أن تتقدم.",
  ],

  en: [
    "Start small. Consistency will do the heavy lifting.",
    "One focused hour beats a perfect plan you never start.",
    "Every study session moves you closer to your goal.",
    "Focus on the task in front of you; the rest can wait.",
    "Quiet progress is still progress.",
    "You do not need to finish everything today, just start with what matters most.",
    "Make today's goal clear, then begin.",
    "Consistency beats temporary motivation.",
    "Small repeated effort becomes a big result.",
    "Start even if you do not feel completely ready.",
    "Every small step today makes tomorrow easier.",
    "Your job is not to be perfect; it is to make progress.",
  ],
} as const;

function dailyMotivation(
  day: string,
  locale: "ar" | "en",
) {
  const list = DAILY_MOTIVATION[locale];

  const key = Number(
    day.replaceAll("-", ""),
  );

  return list[key % list.length];
}

export default async function Page() {
  const [data, stats, challenges] = await Promise.all([
    planningData(),
    progressData(),
    getChallenges(),
  ]);
  const challengeSnapshot = challenges.kind === "authenticated" ? { userId: challenges.userId, challenges: challenges.challenges } : null;

  const {
    progress,
    profile,
    settings,
  } = stats;

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
      .filter(
        (item) =>
          item.starts > data.now,
      )
      .sort((a, b) =>
        a.starts.localeCompare(b.starts),
      )[0] ?? null;

  const hour = Number(
    new Intl.DateTimeFormat("en", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: progress.zone,
    }).format(
      new Date(data.now),
    ),
  );

  const locale =
    settings.locale === "ar"
      ? "ar"
      : "en";

  return (
    <main
      id="main"
      className="study-main"
    >
      <ProgressHeading
        name={
          profile.display_name ?? ""
        }
        hour={hour}
      />

      <Card className="mb-6">
        <p className="eyebrow mb-2">
          {locale === "ar"
            ? "رسالة اليوم"
            : "Today's note"}
        </p>

        <p className="text-lg font-semibold leading-8">
          {dailyMotivation(
            progress.today,
            locale,
          )}
        </p>
      </Card>

      <div className="dashboard-grid">
        <GoalCard
          progress={progress}
          goal={
            profile.daily_goal_minutes ??
            120
          }
        />

        <QuickFocus
          minutes={
            settings.focus_minutes
          }
        />

        <DashboardTasks
          tasks={tasks}
        />

        <NextSession
          next={next}
          subjects={
            data.subjects
          }
          zone={
            progress.zone
          }
        />

        <WeeklyChart
          progress={progress}
        />

        <StreakCard
          streak={
            progress.streak
          }
        />
      </div>
      <DailyChallengesWidget snapshot={challengeSnapshot} />
    </main>
  );
}
