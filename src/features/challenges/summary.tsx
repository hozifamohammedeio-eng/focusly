"use client";

import Link from "next/link";
import { useLocale } from "@/features/i18n/locale-provider";
import { Card } from "@/components/ui/card";
import type { ChallengeProgress } from "./data";

type Snapshot = { userId: string; challenges: readonly ChallengeProgress[] } | null;

export function DailyChallengesWidget({ snapshot }: { snapshot: Snapshot }) {
  const { locale } = useLocale();
  const ar = locale === "ar";
  const number = new Intl.NumberFormat(locale);
  const daily = snapshot?.challenges.filter((row) => row.challenge_key === "daily_focus_25" || row.challenge_key === "daily_tasks_2") ?? [];
  const completed = daily.filter((row) => row.completed).length;
  return (
    <Card className="mt-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold">{ar ? "تحديات اليوم" : "Today's challenges"}</h2>
        <Link href="/app/challenges" className="text-sm font-semibold underline underline-offset-4">{ar ? "كل التحديات" : "All challenges"}</Link>
      </div>
      {daily.length === 2 && <p className="muted mb-4 text-sm">{completed === 2
        ? (ar ? "اكتملت تحديات اليوم" : "Today's challenges complete")
        : (ar ? `${number.format(completed)} من ${number.format(2)} مكتمل` : `${number.format(completed)} of ${number.format(2)} complete`)}</p>}
      {snapshot === null ? <p className="muted text-sm">{ar ? "تقدم التحديات غير متاح حاليًا." : "Challenge progress is currently unavailable."}</p> : (
        <div className="grid gap-4 sm:grid-cols-2">
          {(["daily_focus_25", "daily_tasks_2"] as const).map(key => {
            const row = snapshot.challenges.find(item => item.challenge_key === key);
            const label = key === "daily_focus_25" ? (ar ? "دقائق التركيز" : "Focus minutes") : (ar ? "المهام المكتملة" : "Completed tasks");
            return <div key={key}>
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <span>{label}{row?.completed ? (ar ? " — مكتمل" : " — Completed") : ""}</span>
                {row && <bdi dir="ltr">{number.format(row.progress)} / {number.format(row.target)}</bdi>}
              </div>
              {row ? <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={row.target} aria-valuenow={row.progress} className="h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--foreground)_10%,transparent)]">
                <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${row.progress / row.target * 100}%` }} />
              </div> : <p className="muted text-xs">{ar ? "لا توجد فترة نشطة حاليًا." : "No active period right now."}</p>}
            </div>;
          })}
        </div>
      )}
    </Card>
  );
}
