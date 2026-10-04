import type { Locale } from "./model";

export const companionCopy: Record<Locale, {
  setup: string; nameLabel: string; namePlaceholder: string; saveName: string; named: (name: string) => string;
  open: string; close: string; send: string; placeholder: string; studyNow: string; planDay: string; remind: string;
  greetingTasks: (count: number) => string; greetingOverdue: (count: number) => string;
  greetingUpcoming: (title: string) => string; greetingGoal: string; greetingDone: string; greetingEmpty: string;
  suggested: (title: string, why: string) => string; overdueReason: string; todayReason: string; priorityReason: string;
  startFocus: string; openTask: string; openPlanner: string; noTasks: string; planReady: string; planNone: string;
  available: string; minutes: string; applyPlan: string; planSaved: string; planConflict: string;
  reminderPrompt: string; reminderConfirm: (title: string, when: string) => string; saveReminder: string; reminderSaved: string;
  reminderDue: (title: string) => string; notificationsAsk: string; notificationsEnable: string; notificationsLater: string;
  tryAgain: string; busy: string; invalidName: string; disabled: string; showWhenOpen: string; enabled: string;
  save: string; saved: string; confirm: string; cancel: string; loading: string;
}> = {
  en: {
    setup: "Hey 👋 I'm here to help you organize your studying. First... what would you like to call me?",
    nameLabel: "Your companion's name", namePlaceholder: "A name you like", saveName: "Save name",
    named: name => `Great, I'm ${name} now ✨ Ready to begin?`,
    open: "Open study companion", close: "Minimize companion", send: "Send", placeholder: "Ask about your studying…",
    studyNow: "What should I study now?", planDay: "Plan my day", remind: "Remind me",
    greetingTasks: count => `You have ${count} task${count === 1 ? "" : "s"} today. Want help choosing where to start?`,
    greetingOverdue: count => `You have ${count} overdue task${count === 1 ? "" : "s"}. Let's start with one small step.`,
    greetingUpcoming: title => `${title} is coming up soon. Want to get ready?`,
    greetingGoal: "A small focus session could help you get started today.",
    greetingDone: "You reached your study goal today 👏 Want to prepare for tomorrow?",
    greetingEmpty: "Ready to plan a calm study session?",
    suggested: (title, why) => `A good next step is ${title}, ${why} Start with 25 minutes?`,
    overdueReason: "because it's overdue.", todayReason: "because it's on today's list.", priorityReason: "because it's high priority.",
    startFocus: "Start focus", openTask: "Open task", openPlanner: "Open Planner",
    noTasks: "There aren't any tasks to recommend right now. Add one in Tasks or plan your week.",
    planReady: "Here's a short plan for today. Review it before applying; your existing Planner items stay in place.",
    planNone: "I couldn't find a free slot for today's unfinished tasks. Try a smaller time window or open Planner.",
    available: "Minutes available today", minutes: "min", applyPlan: "Apply plan", planSaved: "Your study sessions are in Planner.", planConflict: "That time now conflicts with your Planner. Refresh and try again.",
    reminderPrompt: "What should I remind you about, and when? For example: Remind me to review chemistry tomorrow at 6 PM.",
    reminderConfirm: (title, when) => `I'll remind you to ${title} on ${when}. Save this reminder?`,
    saveReminder: "Save reminder", reminderSaved: "Reminder saved.", reminderDue: title => `Study reminder: ${title}`,
    notificationsAsk: "Would you like a browser notification while Focusly is open? In-app reminders work either way.",
    notificationsEnable: "Enable notifications", notificationsLater: "Not now", tryAgain: "I couldn't help with that right now. Please try again.",
    busy: "The AI service is busy. Try again shortly.", invalidName: "Choose a name up to 40 characters.",
    disabled: "Study companion is off. You can turn it back on in Settings.", showWhenOpen: "Show study companion when I open Focusly",
    enabled: "Enable study companion", save: "Save", saved: "Saved", confirm: "Confirm", cancel: "Cancel", loading: "Thinking…",
  },
  ar: {
    setup: "أهلًا 👋 أنا هنا عشان أساعدك في تنظيم مذاكرتك. بس الأول... تحب تسميني إيه؟",
    nameLabel: "اسم رفيق المذاكرة", namePlaceholder: "الاسم اللي تحبه", saveName: "حفظ الاسم",
    named: name => `تمام، من دلوقتي أنا ${name} ✨ جاهز نبدأ؟`,
    open: "فتح رفيق المذاكرة", close: "تصغير رفيق المذاكرة", send: "إرسال", placeholder: "اسألني عن مذاكرتك…",
    studyNow: "ماذا أذاكر الآن؟", planDay: "خطط لي يومي", remind: "فكرني بحاجة",
    greetingTasks: count => `${count === 1 ? "عندك مهمة" : count === 2 ? "عندك مهمتين" : `عندك ${count} مهام`} النهارده. تحب أقولك تبدأ بإيه؟`,
    greetingOverdue: count => `${count === 1 ? "عندك مهمة متأخرة" : count === 2 ? "عندك مهمتين متأخرتين" : `عندك ${count} مهام متأخرة`}. نبدأ بخطوة صغيرة؟`,
    greetingUpcoming: title => `عندك ${title} قريب. تحب تجهز له؟`,
    greetingGoal: "ممكن نبدأ بجلسة مذاكرة صغيرة النهارده.",
    greetingDone: "خلصت هدفك النهارده 👏 تحب نجهز بكرة؟",
    greetingEmpty: "جاهز نرتب جلسة مذاكرة هادئة؟",
    suggested: (title, why) => `أنسب حاجة تبدأ بيها دلوقتي هي ${title}، ${why} نبدأ 25 دقيقة؟`,
    overdueReason: "عشان متأخرة.", todayReason: "عشان موجودة في مهام النهارده.", priorityReason: "عشان أولويتها عالية.",
    startFocus: "ابدأ التركيز", openTask: "افتح المهمة", openPlanner: "افتح المخطط",
    noTasks: "مفيش مهام أقدر أرشحها دلوقتي. ضيف مهمة أو رتّب أسبوعك.",
    planReady: "دي خطة بسيطة لليوم. راجعها قبل التطبيق؛ مواعيدك الموجودة في المخطط هتفضل زي ما هي.",
    planNone: "ملقتش وقت فاضي لمهام النهارده. جرّب وقت أقل أو افتح المخطط.",
    available: "الدقائق المتاحة النهارده", minutes: "دقيقة", applyPlan: "تطبيق الخطة", planSaved: "جلسات المذاكرة اتضافت للمخطط.", planConflict: "الوقت ده بقى متعارض مع المخطط. حدّث الصفحة وجرّب تاني.",
    reminderPrompt: "تحب أفكرك بإيه وإمتى؟ مثلًا: فكرني أراجع الكيمياء بكرة الساعة ٦ مساءً.",
    reminderConfirm: (title, when) => `هفكرك بـ${title} يوم ${when}. نحفظ التذكير؟`,
    saveReminder: "حفظ التذكير", reminderSaved: "تم حفظ التذكير.", reminderDue: title => `تذكير بالمذاكرة: ${title}`,
    notificationsAsk: "تحب يوصلك إشعار من المتصفح وFocusly مفتوح؟ التذكيرات جوه التطبيق شغالة في كل الأحوال.",
    notificationsEnable: "تفعيل الإشعارات", notificationsLater: "مش دلوقتي", tryAgain: "مش قادر أساعدك دلوقتي. جرّب تاني.",
    busy: "خدمة الذكاء الاصطناعي مشغولة دلوقتي. جرّب كمان شوية.", invalidName: "اختار اسم لحد ٤٠ حرف.",
    disabled: "رفيق المذاكرة متوقف. تقدر تفعّله من الإعدادات.", showWhenOpen: "إظهار رفيق المذاكرة عند فتح Focusly",
    enabled: "تفعيل رفيق المذاكرة", save: "حفظ", saved: "تم الحفظ", confirm: "تأكيد", cancel: "إلغاء", loading: "بفكر…",
  },
};
