import type { ChallengeKey } from "@/features/challenges/catalog";

type ChallengeEntry = { name: string; description: string; requirement: string; action: string; unit: string };
type Copy = {
  eyebrow: string; title: string; intro: string; daily: string; weekly: string;
  dailyDescription: string; weeklyDescription: string; completed: string; inProgress: string;
  pending: string; unavailable: string; inactive: string; start: string; allDone: string;
  periodProgress: string; activeWindow: string; ends: string; starts: string; next: string;
  nextDescription: string; noNext: string; details: string; close: string; requirement: string;
  progress: string; reward: string; coins: string; automatic: string; automaticDetail: string;
  open: string; goTo: string; saturdayFriday: string; entries: Record<ChallengeKey, ChallengeEntry>;
};

export const challengesCopy: Record<"en" | "ar", Copy> = {
  en: {
    eyebrow: "FOCUSLY CHALLENGES", title: "Your challenges",
    intro: "Small goals for today's work and the week ahead. Your real study activity moves them forward automatically.",
    daily: "Daily", weekly: "Weekly", dailyDescription: "A fresh start every day",
    weeklyDescription: "A longer rhythm, Saturday through Friday",
    completed: "Completed", inProgress: "In progress", pending: "Target reached · completion pending",
    unavailable: "Challenge progress is unavailable right now. Try again later.",
    inactive: "No active period is available for this challenge right now.",
    start: "Your next study session can start here.", allDone: "All challenges for this period are complete. Keep studying at your own pace.",
    periodProgress: "Period progress", activeWindow: "Active period", ends: "Ends", starts: "Started",
    next: "Closest to completion", nextDescription: "A useful next step from your current progress.",
    noNext: "There is no active challenge to continue right now.", details: "Challenge details", close: "Close details",
    requirement: "How to complete it", progress: "Progress", reward: "Automatic reward", coins: "Coins",
    automatic: "Just study. Rewards happen automatically.",
    automaticDetail: "Focusly counts qualifying Focus sessions and completed tasks in your active period. Once a challenge completes, its XP and Coins are awarded without a claim button. Rewards can also contribute to your City.",
    open: "View details", goTo: "Continue with", saturdayFriday: "Saturday–Friday week",
    entries: {
      daily_focus_25: { name: "Focused 25", description: "Make room for one focused study block today.", requirement: "Complete 25 qualifying Focus minutes during this day.", action: "Focus", unit: "focus minutes" },
      daily_tasks_2: { name: "Get Things Done", description: "Turn two real study tasks into finished work.", requirement: "Complete two study tasks during this day.", action: "Tasks", unit: "completed tasks" },
      weekly_focus_180: { name: "Deep Week", description: "Build a steady 180 minutes of focused study.", requirement: "Complete 180 qualifying Focus minutes during this week.", action: "Focus", unit: "focus minutes" },
      weekly_subjects_2: { name: "Balanced Study", description: "Give two different subjects meaningful attention.", requirement: "Make qualifying Focus or Task progress in two different subjects during this week.", action: "Subjects", unit: "studied subjects" },
    },
  },
  ar: {
    eyebrow: "FOCUSLY CHALLENGES", title: "تحدياتك",
    intro: "أهداف بسيطة لمذاكرة النهارده والأسبوع الجاي. نشاطك الحقيقي يقدّمها تلقائيًا.",
    daily: "اليومية", weekly: "الأسبوعية", dailyDescription: "بداية جديدة كل يوم",
    weeklyDescription: "خطوات ثابتة من السبت إلى الجمعة",
    completed: "مكتمل", inProgress: "قيد التقدم", pending: "وصلت للهدف · في انتظار تسجيل الإكمال",
    unavailable: "تقدم التحديات غير متاح حاليًا. حاول مرة أخرى لاحقًا.",
    inactive: "لا توجد فترة نشطة لهذا التحدي حاليًا.",
    start: "جلسة المذاكرة القادمة ممكن تكون البداية.", allDone: "أكملت تحديات هذه الفترة. واصل المذاكرة على راحتك.",
    periodProgress: "تقدم الفترة", activeWindow: "الفترة الحالية", ends: "ينتهي", starts: "بدأت",
    next: "الأقرب للاكتمال", nextDescription: "خطوة تالية مفيدة حسب تقدمك الحالي.",
    noNext: "لا يوجد تحدٍ نشط تواصل فيه حاليًا.", details: "تفاصيل التحدي", close: "إغلاق التفاصيل",
    requirement: "طريقة إكماله", progress: "التقدم", reward: "مكافأة تلقائية", coins: "عملات",
    automatic: "ذاكر فقط، والمكافآت تتم تلقائيًا.",
    automaticDetail: "يحسب Focusly جلسات التركيز والمهام المكتملة المستوفية للشروط خلال الفترة النشطة. عند إكمال التحدي تُضاف نقاط XP والعملات دون زر مطالبة، وقد تساهم المكافأة في نمو مدينتك.",
    open: "عرض التفاصيل", goTo: "تابع في", saturdayFriday: "أسبوع السبت–الجمعة",
    entries: {
      daily_focus_25: { name: "25 دقيقة تركيز", description: "خصص وقتًا لمذاكرة مركزة اليوم.", requirement: "أكمل 25 دقيقة تركيز مستوفية للشروط خلال اليوم.", action: "التركيز", unit: "دقيقة تركيز" },
      daily_tasks_2: { name: "أنجز مهامك", description: "حوّل مهمتين حقيقيتين إلى عمل منجز.", requirement: "أكمل مهمتين دراسيتين خلال اليوم.", action: "المهام", unit: "مهمة مكتملة" },
      weekly_focus_180: { name: "أسبوع عميق", description: "اجمع 180 دقيقة من المذاكرة المركزة.", requirement: "أكمل 180 دقيقة تركيز مستوفية للشروط خلال الأسبوع.", action: "التركيز", unit: "دقيقة تركيز" },
      weekly_subjects_2: { name: "مذاكرة متوازنة", description: "اهتم بمادتين مختلفتين خلال الأسبوع.", requirement: "حقق تقدمًا مستوفيًا للشروط في التركيز أو المهام لمادتين مختلفتين خلال الأسبوع.", action: "المواد", unit: "مادة تمت مذاكرتها" },
    },
  },
};
