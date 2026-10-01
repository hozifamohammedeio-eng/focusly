import type { Locale } from "./messages";

type Copy = {
  morning: string; afternoon: string; evening: string; intro: string;
  today: string; todayHint: string; tasksDone: string; focusToday: string; dailyGoal: string;
  dailyChallenges: string; focus: string; focusHint: string; focusEmpty: string;
  startFocus: string; returnFocus: string; openFocus: string; goalReached: string; remaining: string;
  tasks: string; tasksEmpty: string; tasksMore: string; tasksUnavailable: string;
  complete: string; due: string;
  challenges: string; challengesHint: string; daily: string; weekly: string;
  challengesEmpty: string; challengesDone: string; challengesUnavailable: string;
  achievements: string; achievementClose: string; achievementsEmpty: string;
  achievementsDone: string; achievementsUnavailable: string; unlocked: string;
  city: string; cityHint: string; cityEmpty: string; cityDone: string; cityUnavailable: string;
  levels: string; buildings: string; week: string; weekHint: string; weekEmpty: string;
  studyDays: string; streak: string; days: string; minutes: string; noData: string;
  viewAll: string; openTasks: string; openChallenges: string;
  openAchievements: string; openCity: string; openStatistics: string;
};

export const dashboardCopy: Record<Locale, Copy> = {
  en: {
    morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening",
    intro: "Here's your study day.", today: "Today", todayHint: "A clear view of what matters now.",
    tasksDone: "Tasks finished", focusToday: "Focused today", dailyGoal: "Daily goal",
    dailyChallenges: "Daily challenges", focus: "Make room to focus", focusHint: "Your study time today",
    focusEmpty: "A focused session is a good place to begin.", startFocus: "Start Focus",
    returnFocus: "Return to Focus", openFocus: "Open Focus", goalReached: "Daily goal reached", remaining: "left toward your goal",
    tasks: "Today's tasks", tasksEmpty: "Your day is clear. Add a task when you're ready.",
    tasksMore: "More tasks for today", tasksUnavailable: "Today's tasks are unavailable right now.",
    complete: "Completed", due: "Due",
    challenges: "Challenges", challengesHint: "Real study moves these forward.", daily: "Daily", weekly: "Weekly",
    challengesEmpty: "Your next study session can start a challenge.", challengesDone: "All challenges for this period are complete.",
    challengesUnavailable: "Challenge progress is unavailable right now.",
    achievements: "Achievements", achievementClose: "Closest milestone", achievementsEmpty: "Your first achievement starts with a session or a task.",
    achievementsDone: "Every achievement is unlocked.", achievementsUnavailable: "Achievement progress is unavailable right now.",
    unlocked: "unlocked", city: "Your City", cityHint: "Built by your confirmed study rewards.",
    cityEmpty: "Your City is ready to grow with your study.", cityDone: "Every City level is complete.",
    cityUnavailable: "City progress is unavailable right now.", levels: "levels", buildings: "buildings",
    week: "This week", weekHint: "Saturday through Friday", weekEmpty: "The week is ready for your first session.",
    studyDays: "Study days", streak: "Focus streak", days: "days", minutes: "min",
    noData: "Unavailable", viewAll: "View all", openTasks: "Open Tasks",
    openChallenges: "Open Challenges", openAchievements: "Open Achievements", openCity: "Open City",
    openStatistics: "Open Statistics",
  },
  ar: {
    morning: "صباح الخير", afternoon: "مساء الخير", evening: "مساء الخير",
    intro: "دي لمحة واضحة عن يوم مذاكرتك.", today: "النهارده", todayHint: "أهم حاجة قدامك دلوقتي.",
    tasksDone: "مهام خلصت", focusToday: "تركيز النهارده", dailyGoal: "الهدف اليومي",
    dailyChallenges: "تحديات اليوم", focus: "وقت للتركيز", focusHint: "وقت مذاكرتك النهارده",
    focusEmpty: "جلسة تركيز واحدة بداية كويسة.", startFocus: "ابدأ تركيز",
    returnFocus: "ارجع للتركيز", openFocus: "افتح التركيز", goalReached: "حققت هدف اليوم", remaining: "متبقي على هدفك",
    tasks: "مهام النهارده", tasksEmpty: "يومك فاضي من المهام. أضف مهمة لما تكون جاهز.",
    tasksMore: "مهام تانية للنهارده", tasksUnavailable: "مهام النهارده غير متاحة حاليًا.",
    complete: "مكتمل", due: "الموعد",
    challenges: "التحديات", challengesHint: "مذاكرتك الحقيقية بتحركها.", daily: "اليومية", weekly: "الأسبوعية",
    challengesEmpty: "جلسة المذاكرة الجاية ممكن تبدأ تحديًا.", challengesDone: "اكتملت تحديات الفترة دي.",
    challengesUnavailable: "تقدم التحديات غير متاح حاليًا.",
    achievements: "الإنجازات", achievementClose: "أقرب إنجاز", achievementsEmpty: "أول إنجاز يبدأ بجلسة تركيز أو مهمة.",
    achievementsDone: "فتحت كل الإنجازات.", achievementsUnavailable: "تقدم الإنجازات غير متاح حاليًا.",
    unlocked: "مفتوح", city: "مدينتك", cityHint: "بتنمو بمكافآت مذاكرتك المؤكدة.",
    cityEmpty: "مدينتك جاهزة تكبر مع مذاكرتك.", cityDone: "كل مستويات المدينة اكتملت.",
    cityUnavailable: "تقدم المدينة غير متاح حاليًا.", levels: "مستوى", buildings: "مبانٍ",
    week: "الأسبوع ده", weekHint: "من السبت للجمعة", weekEmpty: "الأسبوع مستني أول جلسة مذاكرة.",
    studyDays: "أيام مذاكرة", streak: "سلسلة التركيز", days: "يوم", minutes: "دقيقة",
    noData: "غير متاح", viewAll: "عرض الكل", openTasks: "افتح المهام",
    openChallenges: "افتح التحديات", openAchievements: "افتح الإنجازات", openCity: "افتح المدينة",
    openStatistics: "افتح الإحصاءات",
  },
};
