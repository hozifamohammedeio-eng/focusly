export const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

type Messages = {
  shell: {
    phase: string;
    title: string;
    description: string;
    theme: string;
    accent: string;
    foundation: string;
    next: string;
    nextTitle: string;
    nextDescription: string;
  };
  foundation: Record<"localization" | "themes" | "supabase", string>;
  theme: Record<"light" | "dark" | "system", string>;
  accent: Record<"violet" | "blue" | "green" | "orange", string>;
};

export const messages: Record<Locale, Messages> = {
  en: {
    shell: {
      phase: "Phase 1 · Foundation",
      title: "A calm place to build better study days.",
      description:
        "The engineering foundation is ready: strict typing, responsive primitives, bilingual direction support, themes, and secure Supabase boundaries.",
      theme: "Theme",
      accent: "Accent color",
      foundation: "Foundation status",
      next: "Next phase",
      nextTitle: "Authentication and onboarding",
      nextDescription:
        "Email and password flows, password recovery, and student setup will be implemented only after Phase 2 begins.",
    },
    foundation: {
      localization: "Arabic and English",
      themes: "Theme system",
      supabase: "Supabase clients and RLS",
    },
    theme: { light: "Light", dark: "Dark", system: "System" },
    accent: {
      violet: "Violet",
      blue: "Blue",
      green: "Green",
      orange: "Orange",
    },
  },
  ar: {
    shell: {
      phase: "المرحلة الأولى · الأساس",
      title: "مساحة هادئة لبناء أيام دراسية أفضل.",
      description:
        "الأساس الهندسي جاهز: أنواع صارمة، ومكوّنات متجاوبة، ودعم العربية والإنجليزية، والسمات، وحدود آمنة لقاعدة البيانات.",
      theme: "السمة",
      accent: "اللون المميز",
      foundation: "حالة الأساس",
      next: "المرحلة التالية",
      nextTitle: "تسجيل الدخول والتهيئة",
      nextDescription:
        "سيتم تنفيذ البريد الإلكتروني وكلمة المرور واستعادة الحساب وإعداد الطالب عند بدء المرحلة الثانية.",
    },
    foundation: {
      localization: "العربية والإنجليزية",
      themes: "نظام السمات",
      supabase: "Supabase وسياسات الحماية",
    },
    theme: { light: "فاتح", dark: "داكن", system: "النظام" },
    accent: {
      violet: "بنفسجي",
      blue: "أزرق",
      green: "أخضر",
      orange: "برتقالي",
    },
  },
};
