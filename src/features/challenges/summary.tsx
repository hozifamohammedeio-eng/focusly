"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "@/features/i18n/locale-provider";
import { Card } from "@/components/ui/card";
import type { ChallengeProgress } from "./data";

type Snapshot = { userId: string; challenges: readonly ChallengeProgress[] } | null;
const seenInMemory = new Set<string>();

/** A receipt is scoped to an authenticated user and one awarded challenge period. */
export function completionKey(userId: string, row: ChallengeProgress) {
  return `focusly-challenge-seen:v1:${userId}:${row.challenge_key}:${row.starts_at}`;
}

export function consumeChallengeCompletions(userId: string, challenges: readonly ChallengeProgress[], storage: Pick<Storage, "getItem" | "setItem"> | null, seen = seenInMemory) {
  let count = 0;
  for (const row of challenges) {
    if (!row.completed) continue;
    const key = completionKey(userId, row);
    if (seen.has(key)) continue;
    let stored = false;
    try { stored = storage?.getItem(key) === "1"; } catch { /* Optional storage. */ }
    seen.add(key);
    if (stored) continue;
    try { storage?.setItem(key, "1"); } catch { /* Memory still suppresses repeats. */ }
    count++;
  }
  return count;
}

export function ChallengeCompletionFeedback({ snapshot }: { snapshot: Snapshot }) {
  const { locale } = useLocale();
  const [notice, setNotice] = useState<{ userId: string; count: number } | null>(null);
  useEffect(() => {
    if (!snapshot) return;
    // Deferring allows Strict Mode cleanup to cancel an uncommitted mount before
    // consuming receipts. Storage failure falls back to this page's memory.
    const timer = window.setTimeout(() => {
      let storage: Storage | null = null;
      try { storage = window.localStorage; } catch { /* Optional storage. */ }
      const count = consumeChallengeCompletions(snapshot.userId, snapshot.challenges, storage);
      if (count) setNotice({ userId: snapshot.userId, count });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [snapshot]);

  if (!notice || snapshot?.userId !== notice.userId) return null;
  return (
    <div role="status" className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-[var(--accent)] px-4 py-3 text-sm">
      <p>{locale === "ar"
        ? `تحديات مكتملة: ${new Intl.NumberFormat(locale).format(notice.count)}. تمت إضافة مكافآتها تلقائيًا.`
        : `${notice.count} challenge${notice.count === 1 ? "" : "s"} completed. Rewards were added automatically.`}</p>
      <button type="button" className="min-h-10 shrink-0 px-2 font-semibold" onClick={() => setNotice(null)}>
        {locale === "ar" ? "إغلاق" : "Dismiss"}
      </button>
    </div>
  );
}

export function DailyChallengesWidget({ snapshot }: { snapshot: Snapshot }) {
  const { locale } = useLocale();
  const ar = locale === "ar";
  const number = new Intl.NumberFormat(locale);
  return (
    <Card className="mt-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold">{ar ? "تحديات اليوم" : "Today's challenges"}</h2>
        <Link href="/app/challenges" className="text-sm font-semibold underline underline-offset-4">{ar ? "كل التحديات" : "All challenges"}</Link>
      </div>
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
