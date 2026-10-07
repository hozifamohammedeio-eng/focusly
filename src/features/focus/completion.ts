import type { FocusSession } from "./logic.ts";
import type { CityGrowth } from "@/features/city/receipt";

export function completionAlreadyShowsCityGrowth(completion: { growth: CityGrowth | null } | null, growth: CityGrowth | null) {
  return growth !== null && completion?.growth?.eventId === growth.eventId;
}

export function isNewCompletion(action: string, previous: FocusSession | null, next: FocusSession | null) {
  return action === "finish" && !!previous && previous.id === next?.id &&
    !previous.completed && (previous.timer_state === "running" || previous.timer_state === "paused") &&
    next.completed && next.timer_state === "completed";
}

export function confirmedFocusXp(value: unknown): number | null {
  if (!value || typeof value !== "object") return null;
  const claim = value as Record<string, unknown>;
  if (claim.awarded !== true || typeof claim.eventId !== "string" || !claim.reward || typeof claim.reward !== "object") return null;
  const xp = (claim.reward as Record<string, unknown>).xp;
  return typeof xp === "number" && Number.isSafeInteger(xp) && xp > 0 ? xp : null;
}

export const completionMessages = {
  en: ["Nicely done. Take a well-earned break.", "Another session counted. Time to recharge.", "Small steps add up. Enjoy a little rest.", "One more step toward your goal. Breathe and reset."],
  ar: ["خلصتها 👏 شغل جميل. خد بريك تستاهله.", "جلسة كمان اتحسبت ليك ✨ وقت الراحة.", "تقدم صغير النهارده بيعمل فرق كبير بعدين. ريّح شوية.", "خطوة جديدة ناحية هدفك ✅ خد نفسك وارتاح."],
} as const;
