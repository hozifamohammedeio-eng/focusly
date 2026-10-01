"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useLocale } from "@/features/i18n/locale-provider";
import { achievementCopy } from "@/features/i18n/achievements";
import { NEW_ACHIEVEMENTS_KEY, type AchievementAward } from "./achievement-receipt";

export function AchievementRewardToast({ awards, onDismiss }: {
  awards: readonly AchievementAward[];
  onDismiss: () => void;
}) {
  const { locale } = useLocale();
  const t = achievementCopy[locale];
  const key = awards.map((award) => `${award.key}:${award.unlockedAt}`).join("|");
  useEffect(() => {
    if (!key) return;
    try {
      window.sessionStorage.setItem(NEW_ACHIEVEMENTS_KEY, JSON.stringify({ at: Date.now(), unlocks: awards.map((award) => ({ key: award.key, unlockedAt: award.unlockedAt })) }));
    } catch { /* Optional one-time visual hint. */ }
    const timer = window.setTimeout(onDismiss, 6000);
    return () => window.clearTimeout(timer);
  }, [key, awards, onDismiss]);
  if (!awards.length) return null;
  const names = awards.map((award) => t.entries[award.key].name).join(" · ");
  const xp = awards.reduce((sum, award) => sum + award.xp, 0);
  const coins = awards.reduce((sum, award) => sum + award.coins, 0);
  return <div className="study-toast mb-5 flex items-center justify-between gap-3" role="status" aria-live="polite">
    <div>
      <p className="font-semibold">{t.newlyUnlocked}</p>
      <p className="mt-1 text-sm">{names}</p>
      <p dir="ltr" className="mt-1 text-sm">+{xp} XP · +{coins} {t.coins}</p>
      <Link href="/app/achievements" className="mt-1 inline-block text-sm underline underline-offset-4">{t.title}</Link>
    </div>
    <button type="button" className="min-h-11 shrink-0 px-2 font-semibold" onClick={onDismiss} aria-label={t.close}>×</button>
  </div>;
}
