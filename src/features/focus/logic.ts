import type { Database } from "../../types/database.ts";
import { dateAdd, dayInZone } from "../planning/logic.ts";
export type FocusSession =
  Database["public"]["Tables"]["focus_sessions"]["Row"];
export type TimerReply = { session: FocusSession | null; serverNow: string };
export type Progress = {
  zone: string;
  today: string;
  weekStart: string;
  streak: number;
  totalSeconds: number;
  totalSessions: number;
  days: { day: string; seconds: number; sessions: number }[];
  subjects: { subject_id: string | null; seconds: number }[];
  recent: Pick<
    FocusSession,
    "id" | "subject_id" | "duration_seconds" | "ended_at"
  >[];
};
export function elapsedSeconds(
  s: Pick<
    FocusSession,
    | "timer_state"
    | "accumulated_seconds"
    | "running_since"
    | "planned_seconds"
    | "duration_seconds"
  >,
  now: number,
) {
  if (
    s.timer_state ===
      "completed" ||
    s.timer_state ===
      "discarded"
  )
    return s.duration_seconds;

  const elapsed =
    Math.max(
      0,
      s.accumulated_seconds +
        (s.timer_state ===
          "running" &&
        s.running_since
          ? Math.floor(
              (now -
                Date.parse(
                  s.running_since,
                )) /
                1000,
            )
          : 0),
    );

  return s.planned_seconds ===
    null
    ? elapsed
    : Math.min(
        s.planned_seconds,
        elapsed,
      );
}

export function remainingSeconds(
  s: FocusSession,
  now: number,
) {
  if (
    s.planned_seconds ===
    null
  )
    return 0;

  return Math.max(
    0,
    s.planned_seconds -
      elapsedSeconds(s, now),
  );
}
export function stalePaused(s: FocusSession, now: number) {
  return (
    s.timer_state === "paused" && now - Date.parse(s.updated_at) > 7 * 86400000
  );
}
export function timerDigits(seconds: number) {
  const n = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
}
export function formatDuration(seconds: number, locale: "en" | "ar") {
  const minutes = Math.floor(Math.max(0, seconds) / 60),
    h = Math.floor(minutes / 60),
    m = minutes % 60,
    n = new Intl.NumberFormat(locale);
  if (!minutes) return locale === "ar" ? "أقل من دقيقة" : "Less than 1 min";
  return [
    h ? `${n.format(h)} ${locale === "ar" ? "س" : "h"}` : "",
    m ? `${n.format(m)} ${locale === "ar" ? "د" : "min"}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
export function weekDays(progress: Progress) {
  return Array.from({ length: 7 }, (_, i) => {
    const day = dateAdd(progress.weekStart, i);
    return (
      progress.days.find((x) => x.day === day) ?? {
        day,
        seconds: 0,
        sessions: 0,
      }
    );
  });
}
export function todaySeconds(p: Progress) {
  return p.days.find((x) => x.day === p.today)?.seconds ?? 0;
}
export function weekSeconds(p: Progress) {
  return p.days.reduce((n, d) => n + d.seconds, 0);
}
// Full Saturday–Friday calendar week, including zero-study and future days.
export function averageSeconds(p: Progress) {
  return weekSeconds(p) / 7;
}
export function goalProgress(seconds: number, goalMinutes: number) {
  return {
    ratio: seconds / (goalMinutes * 60),
    remaining: Math.max(0, goalMinutes * 60 - seconds),
  };
}
// Pure equivalents verify the database aggregation contract at timezone edges.
export function groupSessions(
  rows: Pick<
    FocusSession,
    "completed" | "duration_seconds" | "ended_at" | "subject_id"
  >[],
  zone: string,
) {
  const days = new Map<string, number>(),
    subjects = new Map<string | null, number>();
  for (const s of rows)
    if (s.completed && s.ended_at && s.duration_seconds >= 60) {
      const d = dayInZone(s.ended_at, zone);
      days.set(d, (days.get(d) ?? 0) + s.duration_seconds);
      subjects.set(
        s.subject_id,
        (subjects.get(s.subject_id) ?? 0) + s.duration_seconds,
      );
    }
  return { days, subjects };
}
export function currentStreak(days: Set<string>, today: string) {
  let day = days.has(today) ? today : dateAdd(today, -1),
    n = 0;
  while (days.has(day)) {
    n++;
    day = dateAdd(day, -1);
  }
  return n;
}
