"use client";

import { useEffect } from "react";
import { useLocale } from "@/features/i18n/locale-provider";
import type { ChallengeAward } from "./receipt";

export function ChallengeRewardToast({ awards, onDismiss }: {
  awards: readonly ChallengeAward[];
  onDismiss: () => void;
}) {
  const { locale } = useLocale();
  const receiptKey = awards.map((award) => award.eventId).join(":");
  useEffect(() => {
    if (!receiptKey) return;
    const timer = window.setTimeout(onDismiss, 6000);
    return () => window.clearTimeout(timer);
  }, [receiptKey, onDismiss]);
  if (!awards.length) return null;
  const xp = awards.reduce((sum, award) => sum + award.xp, 0);
  const coins = awards.reduce((sum, award) => sum + award.coins, 0);
  const ar = locale === "ar";
  return (
    <div className="study-toast mb-5 flex items-center justify-between gap-3" role="status" aria-live="polite">
      <div>
        <p className="font-semibold">{ar ? "اكتمل التحدي 🎯" : "Challenge completed 🎯"}</p>
        <p dir="ltr" className="mt-1 text-sm">+{xp} XP · +{coins} {ar ? "عملات" : "Coins"}</p>
        {awards.some((award) => award.cityGrew) && <p className="mt-1 text-sm">{ar ? "مدينتك تطورت." : "Your city grew."}</p>}
      </div>
      <button type="button" className="min-h-11 shrink-0 px-2 font-semibold" onClick={onDismiss} aria-label={ar ? "إغلاق الإشعار" : "Dismiss notification"}>×</button>
    </div>
  );
}
