import { weekDays, weekSeconds, type Progress } from "./logic";

/** Uses the same owner-scoped Focus RPC week as Dashboard; no history is inferred. */
export function statisticsWeek(progress: Progress) {
  const days = weekDays(progress);
  return {
    days,
    seconds: weekSeconds(progress),
    sessions: days.reduce((total, day) => total + day.sessions, 0),
    activeDays: days.filter(day => day.seconds > 0).length,
    streak: progress.streak,
  };
}

export function subjectShare(seconds: number, totalSeconds: number) {
  return totalSeconds > 0 ? Math.round(seconds / totalSeconds * 100) : 0;
}
