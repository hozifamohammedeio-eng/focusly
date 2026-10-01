import type { AchievementKey } from "@/features/progression/achievements";
import type { Locale } from "./messages";

type Entry = { name: string; description: string; requirement: string; encouragement: string; unit: string };
type Copy = {
  title: string; intro: string; unlocked: string; locked: string; inProgress: string; newlyUnlocked: string;
  all: string; almost: string; recent: string; collection: string; reward: string; requirement: string;
  progress: string; completed: string; automatic: string; unavailable: string; starting: string;
  allDone: string; close: string; details: string; reached: string; coins: string; earned: string;
  categories: Record<"focus" | "tasks" | "progression" | "mastery", string>;
  entries: Record<AchievementKey, Entry>;
};

export const achievementCopy: Record<Locale, Copy> = {
  en: {
    title: "Achievements", intro: "A collection of the moments your study has earned. Keep going at your own pace.",
    unlocked: "Unlocked", locked: "Locked", inProgress: "In progress", newlyUnlocked: "Newly unlocked",
    all: "All", almost: "Almost there", recent: "Recently unlocked", collection: "Your collection",
    reward: "Reward", requirement: "Requirement", progress: "Progress", completed: "Complete",
    automatic: "Achievements unlock automatically after confirmed study rewards. Their XP and Coins support your progression and future City growth.",
    unavailable: "Achievement progress is unavailable right now. Please try again later.",
    starting: "Your collection starts here. A completed Focus session or task can unlock your first badge.",
    allDone: "Every achievement is yours. Your collection stays here to revisit.",
    close: "Close details", details: "Achievement details", reached: "Requirement reached — awaiting the next confirmed reward.",
    coins: "Coins", earned: "Unlocked on",
    categories: { focus: "Focus", tasks: "Tasks", progression: "Progression", mastery: "Subjects" },
    entries: {
      first_focus: { name: "First Focus", description: "Your first completed study session.", requirement: "Complete one Focus session of at least one minute.", encouragement: "One focused session is a beginning worth keeping.", unit: "sessions" },
      focus_5: { name: "Focused Five", description: "Make focused study a habit.", requirement: "Complete five qualifying Focus sessions.", encouragement: "Each return to your desk adds up.", unit: "sessions" },
      focus_60_minutes: { name: "One Focused Hour", description: "An hour of real attention.", requirement: "Accumulate 60 whole Focus minutes in qualifying sessions.", encouragement: "A full hour is built minute by minute.", unit: "minutes" },
      focus_300_minutes: { name: "Five Focused Hours", description: "A deeper commitment to your work.", requirement: "Accumulate 300 whole Focus minutes in qualifying sessions.", encouragement: "Your steady attention is creating momentum.", unit: "minutes" },
      first_task: { name: "First Step", description: "Turn a plan into a finished task.", requirement: "Complete one study task.", encouragement: "A finished task makes the next one easier.", unit: "tasks" },
      tasks_10: { name: "Ten Tasks Done", description: "A strong trail of completed work.", requirement: "Complete ten study tasks.", encouragement: "Your plans are becoming progress.", unit: "tasks" },
      level_2: { name: "Level Two", description: "Your study rewards are building up.", requirement: "Earn 100 total XP from trusted reward events.", encouragement: "Keep collecting real study progress.", unit: "XP" },
      level_5: { name: "Level Five", description: "A milestone of consistent effort.", requirement: "Earn 550 total XP from trusted reward events.", encouragement: "Your effort is shaping a lasting routine.", unit: "XP" },
      first_subject_level_2: { name: "Subject Scholar", description: "Grow your mastery in one subject.", requirement: "Earn 100 XP attributed to one of your subjects.", encouragement: "Spend a little more time with a subject you care about.", unit: "subject XP" },
    },
  },
  ar: {
    title: "إنجازاتك", intro: "مجموعة لحظات استحقيتها بمذاكرتك. كمل على وتيرتك.",
    unlocked: "تم فتحه", locked: "مغلق", inProgress: "قيد التقدم", newlyUnlocked: "إنجاز جديد",
    all: "الكل", almost: "قربت توصل", recent: "إنجازات حديثة", collection: "مجموعتك",
    reward: "المكافأة", requirement: "الشرط", progress: "التقدم", completed: "اكتمل",
    automatic: "تُفتح الإنجازات تلقائيًا بعد تأكيد مكافأة مذاكرة. وتساعدك نقاط XP والعملات في تقدمك ونمو مدينتك لاحقًا.",
    unavailable: "تقدم الإنجازات غير متاح الآن. حاول مرة أخرى لاحقًا.",
    starting: "مجموعتك تبدأ من هنا. جلسة تركيز أو مهمة مكتملة قد تفتح أول شارة.",
    allDone: "كل الإنجازات أصبحت لك. تقدر ترجع تشوف مجموعتك في أي وقت.",
    close: "إغلاق التفاصيل", details: "تفاصيل الإنجاز", reached: "اكتمل الشرط — في انتظار مكافأة مذاكرة مؤكدة.",
    coins: "عملات", earned: "فُتح في",
    categories: { focus: "التركيز", tasks: "المهام", progression: "التقدم", mastery: "المواد" },
    entries: {
      first_focus: { name: "أول تركيز", description: "أول جلسة مذاكرة مكتملة.", requirement: "أكمل جلسة تركيز مدتها دقيقة واحدة على الأقل.", encouragement: "جلسة واحدة بتركيز هي بداية تستحق التقدير.", unit: "جلسات" },
      focus_5: { name: "خمس جلسات", description: "خلّي التركيز عادة مستمرة.", requirement: "أكمل خمس جلسات تركيز مؤهلة.", encouragement: "كل مرة ترجع فيها لمذاكرتك بتفرق.", unit: "جلسات" },
      focus_60_minutes: { name: "ساعة تركيز", description: "ساعة كاملة من الانتباه الحقيقي.", requirement: "اجمع ٦٠ دقيقة تركيز كاملة من جلسات مؤهلة.", encouragement: "الساعة الكاملة بتتكوّن دقيقة وراء دقيقة.", unit: "دقائق" },
      focus_300_minutes: { name: "خمس ساعات تركيز", description: "وقت أعمق خصصته لمذاكرتك.", requirement: "اجمع ٣٠٠ دقيقة تركيز كاملة من جلسات مؤهلة.", encouragement: "استمرارك الهادئ بيصنع فرقًا واضحًا.", unit: "دقائق" },
      first_task: { name: "أول خطوة", description: "حوّل خطة إلى مهمة منجزة.", requirement: "أكمل مهمة مذاكرة واحدة.", encouragement: "المهمة المكتملة تسهّل عليك الخطوة الجاية.", unit: "مهام" },
      tasks_10: { name: "عشر مهام", description: "سجل واضح من العمل المنجز.", requirement: "أكمل عشر مهام مذاكرة.", encouragement: "خططك بتتحول إلى تقدم حقيقي.", unit: "مهام" },
      level_2: { name: "المستوى الثاني", description: "مكافآت مذاكرتك بتتراكم.", requirement: "احصل على ١٠٠ XP من مكافآت موثوقة.", encouragement: "كمل مذاكرتك واجمع تقدمك الحقيقي.", unit: "XP" },
      level_5: { name: "المستوى الخامس", description: "محطة مهمة من الاستمرار.", requirement: "احصل على ٥٥٠ XP من مكافآت موثوقة.", encouragement: "مجهودك بيكوّن عادة ثابتة.", unit: "XP" },
      first_subject_level_2: { name: "متقن المادة", description: "طوّر فهمك في مادة واحدة.", requirement: "احصل على ١٠٠ XP منسوبة إلى إحدى موادك.", encouragement: "امنح مادة تهمك مزيدًا من الوقت.", unit: "XP في مادة" },
    },
  },
};
