import type { Locale } from "./model";

/** One place for conversational system copy; never pass provider or database errors through. */
export const companionTone = {
  clarify: (locale: Locale) => locale === "ar" ? "تقصد أنهي واحدة؟" : "Which one did you mean?",
  unsupported: (locale: Locale) => locale === "ar"
    ? "الحاجة دي لسه مش بقدر أعدلها من هنا، بس أقدر أساعدك تشوفها."
    : "I can't change that from here yet, but I can help you find it.",
  understand: (locale: Locale) => locale === "ar"
    ? "مش ماسك قصدك قوي 😅 قولّهالي بطريقة أبسط؟" : "I didn't quite catch that. Can you say it another way?",
  busy: (locale: Locale) => locale === "ar"
    ? "الخدمة مشغولة دلوقتي. جرّب كمان شوية." : "The AI service is busy right now. Try again shortly.",
  working: (locale: Locale) => locale === "ar" ? "ثانية أظبطهالك…" : "One moment…",
  undoDone: (locale: Locale) => locale === "ar" ? "تمام، رجّعتها زي الأول 👌" : "Done — it's back the way it was.",
  undoUnavailable: (locale: Locale) => locale === "ar"
    ? "مش هقدر أرجع التغيير ده بأمان من هنا. راجعه من الصفحة الأول."
    : "I can't safely undo that here. Please check it on the page first.",
  confirm: (locale: Locale, count: number) => locale === "ar"
    ? count > 1 ? `في ${count} تغييرات. أطبّقهم؟` : "أقدر أعمل التغيير ده. أكمّل؟"
    : count > 1 ? `I found ${count} changes. Apply them?` : "I can make that change. Go ahead?",
  taskCreated: (locale: Locale, title: string, day: string) => locale === "ar"
    ? `تمام، ضفت «${title}» ليوم ${day} 👌` : `Done — ${title} is on your list for ${day} 👍`,
  blockPlaced: (locale: Locale, title: string, day: string, time: string) => locale === "ar"
    ? `تمام 👌 ${title} بقت الساعة ${time} يوم ${day}.` : `Done — ${title} is at ${time} on ${day}.`,
  reminderSet: (locale: Locale, title: string, day: string, time: string) => locale === "ar"
    ? `تمام، هفكرك بـ«${title}» الساعة ${time} يوم ${day}.` : `Got it — I'll remind you about ${title} at ${time} on ${day}.`,
  goalSet: (locale: Locale, minutes: number) => locale === "ar"
    ? `هدفك اليومي بقى ${minutes} دقيقة 👌` : `Your daily goal is now ${minutes} minutes 👍`,
  notFound: (locale: Locale) => locale === "ar"
    ? "مش لاقي حاجة مطابقة عندك. ممكن تقولّي اسمها أو يومها؟"
    : "I couldn't find a match. What's its name or day?",
  overlap: (locale: Locale) => locale === "ar"
    ? "المعاد ده محجوز في المخطط. نجرب وقت تاني؟" : "That time is taken in Planner. Want to try another?",
} as const;

export function safeConversationReply(locale: Locale, reply: string, requestedWrite: boolean): string {
  const text = reply.trim();
  if (requestedWrite) return companionTone.unsupported(locale);
  if (!text || text.length > 300 || /\b(?:SQL|RPC|JSON|database|server error|user_id|https?:\/\/)\b/iu.test(text) ||
    /\b(?:added|deleted|saved|updated|moved|completed)\b|(?:حذفت|مسحت|ضفت|نقلت|حفظت|تم التعديل)/iu.test(text))
    return companionTone.understand(locale);
  return text;
}
