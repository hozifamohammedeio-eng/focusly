"use client";
import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/features/i18n/locale-provider";
import { useCopy } from "@/features/i18n/use-copy";
import { subjectLabel } from "@/features/i18n/phase2";
import { phase4 } from "@/features/i18n/phase4";
import { Card } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { mutate } from "@/features/planning/actions";
import { ChallengeRewardToast } from "@/features/challenges/reward-toast";
import type { ChallengeAward } from "@/features/challenges/receipt";
import {
  type Subject,
  type Task,
  type Occurrence,
} from "@/features/planning/logic";
import {
  formatDuration,
  todaySeconds,
  weekSeconds,
  weekDays,
  averageSeconds,
  goalProgress,
  type Progress,
} from "./logic";
export function ProgressHeading({
  name,
  hour,
  statistics = false,
}: {
  name?: string;
  hour?: number;
  statistics?: boolean;
}) {
  const { locale } = useLocale(),
    t = phase4[locale];
  const greeting =
    (hour ?? 12) < 12 ? t.morning : (hour ?? 12) < 18 ? t.afternoon : t.evening;
  return (
    <header className="editorial-heading">
      <p className="eyebrow">FOCUSLY</p>
      <h1 className="mt-3 text-3xl font-semibold">
        {statistics ? t.progress : `${greeting}${name ? ", " + name : ""}.`}
      </h1>
      <p className="muted mt-3">{t.progressHint}</p>
    </header>
  );
}
export function GoalCard({
  progress,
  goal,
}: {
  progress: Progress;
  goal: number;
}) {
  const { locale } = useLocale(),
    t = phase4[locale],
    seconds = todaySeconds(progress),
    g = goalProgress(seconds, goal);
  return (
    <Card variant="accent" className="goal-card">
      <h2 className="font-semibold">{t.goal}</h2>
      <p className="mt-6 text-3xl font-semibold">
        <bdi>{seconds ? formatDuration(seconds, locale) : "0"}</bdi>
        <span className="muted text-lg">
          {" "}
          / {formatDuration(goal * 60, locale)}
        </span>
      </p>
      <progress
        className="focus-progress mt-6"
        aria-label={t.goal}
        max={100}
        value={Math.min(100, g.ratio * 100)}
      />
      <p className="muted mt-4">
        {g.remaining
          ? `${formatDuration(g.remaining, locale)} ${t.left}`
          : t.goalDone}
      </p>
    </Card>
  );
}
export function QuickFocus({ minutes }: { minutes: number }) {
  const { locale } = useLocale(),
    t = phase4[locale];
  return (
    <Card variant="floating" className="quick-focus">
      <h2 className="font-semibold">{t.quick}</h2>
      <p className="quick-digits" dir="ltr">
        {String(minutes).padStart(2, "0")}:00
      </p>
      <p className="muted mb-5">{t.quickHint}</p>
      <ButtonLink href="/app/focus">{t.startSession}</ButtonLink>
    </Card>
  );
}
export function WeeklyChart({ progress }: { progress: Progress }) {
  const { locale } = useLocale(),
    t = phase4[locale],
    days = weekDays(progress),
    max = Math.max(60, ...days.map((d) => d.seconds));
  return (
    <Card variant="paper" className="weekly-card">
      <div className="flex flex-wrap justify-between gap-3">
        <h2 className="font-semibold">{t.weekly}</h2>
        <p className="muted">
          {weekSeconds(progress)
            ? formatDuration(weekSeconds(progress), locale)
            : t.noStudy}
        </p>
      </div>
      <div className="study-chart" role="list" aria-label={t.weekly}>
        {days.map((d) => (
          <div role="listitem" className="chart-day" key={d.day}>
            <div className="chart-bar-area">
              <div
                className="chart-bar"
                style={{ height: `${(d.seconds / max) * 100}%` }}
                aria-hidden="true"
              />
            </div>
            <span>
              {new Intl.DateTimeFormat(locale, {
                weekday: "short",
                timeZone: "UTC",
              }).format(new Date(d.day + "T12:00:00Z"))}
            </span>
            <span className="chart-value">
              {d.seconds ? formatDuration(d.seconds, locale) : "0"}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
export function StreakCard({ streak }: { streak: number }) {
  const { locale } = useLocale(),
    t = phase4[locale];
  return (
    <Card variant="paper" className="streak-card">
      <h2 className="font-semibold">{t.streak}</h2>
      <p className="my-4 text-3xl font-semibold">
        {new Intl.NumberFormat(locale).format(streak)}{" "}
        <span className="text-base font-normal">{t.days}</span>
      </p>
      <p className="muted text-sm">{t.streakHint}</p>
    </Card>
  );
}
export function DashboardTasks({ tasks }: { tasks: Task[] }) {
  const { locale } = useLocale(),
    t = phase4[locale],
    router = useRouter(),
    [pending, start] = useTransition(),
    [error, setError] = useState(false),
    [challengeAwards, setChallengeAwards] = useState<ChallengeAward[]>([]);
  const dismissChallengeAwards = useCallback(() => setChallengeAwards([]), []);
  return (
    <Card className="dashboard-tasks">
      <ChallengeRewardToast awards={challengeAwards} onDismiss={dismissChallengeAwards} />
      <div className="flex justify-between gap-3">
        <h2 className="font-semibold">{t.todayTasks}</h2>
        <ButtonLink href="/app/tasks" variant="ghost">
          {t.viewAll}
        </ButtonLink>
      </div>
      {!tasks.length ? (
        <p className="muted py-8">{t.clear}</p>
      ) : (
        <ul className="mt-4 grid gap-2">
          {tasks.map((x) => (
            <li className="flex items-center gap-3 border-b py-3" key={x.id}>
              <Button
                variant="ghost"
                disabled={pending}
                aria-label={`${t.completeTask}: ${x.title}`}
                onClick={() =>
                  start(async () => {
                    const f = new FormData();
                    f.set("entity", "tasks");
                    f.set("action", "complete");
                    f.set("id", x.id);
                    f.set("completed", "true");
                    const r = await mutate(f);
                    setError(!!r.error);
                    if (r.challengeAwards?.length) setChallengeAwards(r.challengeAwards);
                    if (!r.error) router.refresh();
                  })
                }
              >
                ✓
              </Button>
              <span className="min-w-0 break-words">{x.title}</span>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="form-error" role="alert">
          {t.taskError}
        </p>
      )}
    </Card>
  );
}
export function NextSession({
  next,
  subjects,
  zone,
}: {
  next: Occurrence | null;
  subjects: Subject[];
  zone: string;
}) {
  const { locale } = useLocale(),
    t = phase4[locale],
    p2 = useCopy();
  return (
    <Card variant="paper" className="next-session">
      <h2 className="font-semibold">{t.next}</h2>
      {next ? (
        <div className="my-5">
          <p className="text-xl font-semibold">
            {subjectLabel(
              p2,
              subjects.find((s) => s.id === next.block.subject_id)?.name ??
                t.general,
            )}
          </p>
          <p className="muted mt-3">
            {new Intl.DateTimeFormat(locale, {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: zone,
            }).format(new Date(next.starts))}
          </p>
          <p className="muted mt-2">
            {formatDuration(
              (Date.parse(next.ends) - Date.parse(next.starts)) / 1000,
              locale,
            )}
          </p>
        </div>
      ) : (
        <p className="muted py-7">{t.nothing}</p>
      )}
      <ButtonLink href="/app/planner" variant="ghost">
        {t.plan}
      </ButtonLink>
    </Card>
  );
}
export function StatsSummary({ progress }: { progress: Progress }) {
  const { locale } = useLocale(),
    t = phase4[locale],
    n = (v: number) => new Intl.NumberFormat(locale).format(v);
  return (
    <>
      <div className="stats-summary">
        {[
          [
            t.weekTime,
            weekSeconds(progress)
              ? formatDuration(weekSeconds(progress), locale)
              : "0",
          ],
          [
            t.weekSessions,
            n(progress.days.reduce((v, d) => v + d.sessions, 0)),
          ],
          [t.streak, n(progress.streak) + " " + t.days],
          [
            t.average,
            averageSeconds(progress)
              ? formatDuration(averageSeconds(progress), locale)
              : "0",
          ],
        ].map(([label, value]) => (
          <Card variant="paper" key={label}>
            <h2 className="muted text-sm">{label}</h2>
            <p className="mt-4 text-2xl font-semibold">{value}</p>
          </Card>
        ))}
      </div>
      <p className="muted mt-4 text-sm">{t.averageHint}</p>
      {progress.totalSessions === 0 && (
        <Card className="mt-6">
          <p className="mb-5">{t.empty}</p>
          <ButtonLink href="/app/focus">{t.start}</ButtonLink>
        </Card>
      )}
    </>
  );
}
export function SubjectStats({
  progress,
  subjects,
}: {
  progress: Progress;
  subjects: Subject[];
}) {
  const { locale } = useLocale(),
    t = phase4[locale],
    p2 = useCopy(),
    name = (id: string | null) =>
      subjectLabel(p2, subjects.find((s) => s.id === id)?.name ?? t.general),
    max = Math.max(1, ...progress.subjects.map((s) => s.seconds));
  return (
    <Card variant="paper" className="subject-stats">
      <h2 className="font-semibold">{t.bySubject}</h2>
      <p className="muted mt-2 text-sm">{t.allTime}</p>
      {!progress.subjects.length ? (
        <p className="muted py-8">{t.noStudy}</p>
      ) : (
        <ul className="mt-6 grid gap-6">
          {progress.subjects.map((s) => (
            <li key={s.subject_id ?? "general"}>
              <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm">
                <span className="font-semibold">{name(s.subject_id)}</span>
                <span>{formatDuration(s.seconds, locale)}</span>
              </div>
              <div className="subject-track" aria-hidden="true">
                <div
                  style={{
                    width: `${(s.seconds / max) * 100}%`,
                    background: "var(--foreground)",
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-8 border-t pt-5">
        <p className="muted text-sm">{t.most}</p>
        <p className="mt-2 font-semibold">
          {progress.subjects[0] ? name(progress.subjects[0].subject_id) : "—"}
        </p>
      </div>
    </Card>
  );
}
export function History({
  progress,
  subjects,
}: {
  progress: Progress;
  subjects: Subject[];
}) {
  const { locale } = useLocale(),
    t = phase4[locale],
    p2 = useCopy();
  return (
    <Card variant="paper" className="history-card">
      <div className="mb-7 flex flex-wrap justify-between gap-5">
        <div>
          <h2 className="muted text-sm">{t.total}</h2>
          <p className="mt-2 text-2xl font-semibold">
            {progress.totalSeconds
              ? formatDuration(progress.totalSeconds, locale)
              : "0"}
          </p>
        </div>
        <div>
          <p className="muted text-sm">{t.totalSessions}</p>
          <p className="mt-2 text-2xl font-semibold">
            {new Intl.NumberFormat(locale).format(progress.totalSessions)}
          </p>
        </div>
      </div>
      <h2 className="font-semibold">{t.recent}</h2>
      <ul className="mt-4">
        {progress.recent.map((s) => (
          <li
            key={s.id}
            className="flex flex-wrap justify-between gap-3 border-b py-4"
          >
            <div>
              <p className="font-semibold">
                {subjectLabel(
                  p2,
                  subjects.find((x) => x.id === s.subject_id)?.name ??
                    t.general,
                )}
              </p>
              <p className="muted mt-1 text-sm">
                {s.ended_at
                  ? new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: progress.zone,
                    }).format(new Date(s.ended_at))
                  : ""}
              </p>
            </div>
            <span>{formatDuration(s.duration_seconds, locale)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
