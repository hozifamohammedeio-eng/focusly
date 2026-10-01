"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { useLocale } from "@/features/i18n/locale-provider";
import { achievementCopy } from "@/features/i18n/achievements";
import type { AchievementKey } from "./achievements";

type Summary = { count: number; total: number; latest: { key: AchievementKey; unlockedAt: string } | null } | null;

export function AchievementSummaryWidget({ summary }: { summary: Summary }) {
  const { locale } = useLocale();
  const t = achievementCopy[locale];
  const number = new Intl.NumberFormat(locale);
  return <Card className="mt-6">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-bold">{t.title}</h2>
      <Link href="/app/achievements" className="text-sm font-semibold underline underline-offset-4">{t.collection}</Link>
    </div>
    {!summary ? <p className="muted text-sm">{t.unavailable}</p> : <>
      <p className="text-2xl font-semibold"><bdi dir="ltr">{number.format(summary.count)} / {number.format(summary.total)}</bdi> <span className="muted text-sm font-normal">{t.unlocked}</span></p>
      <p className="muted mt-2 text-sm">{summary.latest ? `${t.recent}: ${t.entries[summary.latest.key].name}` : t.starting}</p>
    </>}
  </Card>;
}
