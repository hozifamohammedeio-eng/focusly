import type { BuildingKey, RequirementMetric } from "@/features/city/domain";
import type { Locale } from "./messages";

type CityStrings = {
  eyebrow: string; title: string; intro: string; automatic: string; unavailable: string;
  xp: string; coins: string; points: string; progress: string; buildings: string;
  map: string; mapHint: string; details: string; level: string; max: string;
  locked: string; available: string; built: string; upgradeable: string;
  next: string; requirements: string; cost: string; balance: string;
  met: string; remaining: string; ready: string; allComplete: string; buildingComplete: string;
  activity: string; noActivity: string; reached: string;
  subjects: string; focus: string; tasks: string; selected: string;
  metrics: Record<RequirementMetric, string>;
  names: Record<BuildingKey, string>;
  descriptions: Record<BuildingKey, string>;
};

export const cityCopy: Record<Locale, CityStrings> = {
  en: {
    eyebrow: "FOCUSLY CITY", title: "Every study session builds your city.", intro: "Six places, shaped by the work you do each day.", automatic: "Your city progresses automatically when a new study reward is confirmed.", unavailable: "City progress is temporarily unavailable. Please try again shortly.",
    xp: "Total XP", coins: "Coins", points: "Construction Points", progress: "City Progress", buildings: "buildings built", map: "Your study district", mapHint: "Choose a building to see its real progress.", details: "Building details", level: "Level", max: "Max Level", locked: "Locked", available: "Requirement met", built: "In progress", upgradeable: "Ready for next level", next: "Next City Milestone", requirements: "Requirements", cost: "Next-level cost", balance: "Your balance", met: "Met", remaining: "to go", ready: "Ready for the next study reward", allComplete: "Every building is at its highest level.", buildingComplete: "This building has reached its highest level.", activity: "Recent City Activity", noActivity: "Your first building will appear here after a confirmed study reward.", reached: "reached Level", subjects: "Explore subjects", focus: "Start focusing", tasks: "Complete tasks", selected: "Selected",
    metrics: { global_xp: "Total XP", focus_minutes: "Focus minutes", subject_xp: "XP in one subject", completed_tasks: "Completed tasks" },
    names: { knowledge_center: "Knowledge Center", focus_tower: "Focus Tower", library_district: "Library District", science_lab: "Science Lab", language_academy: "Language Academy", planner_hall: "Planner Hall" },
    descriptions: { knowledge_center: "The heart of your learning journey.", focus_tower: "A landmark for focused time.", library_district: "A home for deep subject mastery.", science_lab: "A place for discovery and understanding.", language_academy: "A meeting place for new perspectives.", planner_hall: "Where completed plans become progress." },
  },
  ar: {
    eyebrow: "مدينة FOCUSLY", title: "كل جلسة مذاكرة تبني مدينتك.", intro: "ستة معالم تتطور مع مجهودك كل يوم.", automatic: "تنمو مدينتك تلقائيًا عند تأكيد مكافأة مذاكرة جديدة.", unavailable: "تقدم المدينة غير متاح مؤقتًا. حاول مرة أخرى بعد قليل.",
    xp: "إجمالي XP", coins: "العملات", points: "نقاط البناء", progress: "تقدم المدينة", buildings: "مبانٍ مشيّدة", map: "حيّك الدراسي", mapHint: "اختر مبنى لتعرف تقدمه الفعلي.", details: "تفاصيل المبنى", level: "المستوى", max: "أعلى مستوى", locked: "لم يُفتح بعد", available: "اكتمل الشرط", built: "قيد التقدم", upgradeable: "جاهز للمستوى التالي", next: "الخطوة القادمة للمدينة", requirements: "الشروط", cost: "تكلفة المستوى التالي", balance: "رصيدك", met: "مكتمل", remaining: "متبقٍ", ready: "جاهز مع مكافأة المذاكرة التالية", allComplete: "كل المباني وصلت إلى أعلى مستوى.", buildingComplete: "وصل هذا المبنى إلى أعلى مستوى.", activity: "نشاط المدينة الأخير", noActivity: "سيظهر أول مبنى هنا بعد تأكيد مكافأة مذاكرة.", reached: "وصل إلى المستوى", subjects: "استكشف المواد", focus: "ابدأ التركيز", tasks: "أنجز المهام", selected: "محدد",
    metrics: { global_xp: "إجمالي XP", focus_minutes: "دقائق التركيز", subject_xp: "XP في مادة واحدة", completed_tasks: "المهام المكتملة" },
    names: { knowledge_center: "مركز المعرفة", focus_tower: "برج التركيز", library_district: "حي المكتبة", science_lab: "مختبر العلوم", language_academy: "أكاديمية اللغات", planner_hall: "قاعة التخطيط" },
    descriptions: { knowledge_center: "قلب رحلتك التعليمية.", focus_tower: "معلم لوقت المذاكرة المثمر.", library_district: "موطن للتعمق في موادك.", science_lab: "مساحة للاكتشاف والفهم.", language_academy: "ملتقى لآفاق جديدة.", planner_hall: "حيث تتحول الخطط المكتملة إلى تقدم." },
  },
};
