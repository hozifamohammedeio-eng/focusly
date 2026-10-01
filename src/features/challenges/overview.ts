import { challengeCatalog, type ChallengeKey } from "./catalog";
import type { ChallengeProgress } from "./data";

export type ChallengeView = Readonly<{
  key: ChallengeKey;
  current: ChallengeProgress | null;
  percent: number | null;
  remaining: number | null;
  state: "unavailable" | "inactive" | "in_progress" | "pending" | "completed";
}>;

/** Presentation only. The database owns the window, progress, and completion. */
export function challengeViews(challenges: readonly ChallengeProgress[] | null): ChallengeView[] {
  return challengeCatalog.map((definition) => {
    const current = challenges?.find((row) => row.challenge_key === definition.key) ?? null;
    if (!current)
      return { key: definition.key, current: null, percent: null, remaining: null, state: challenges === null ? "unavailable" : "inactive" };
    if (!Number.isSafeInteger(current.progress) || current.progress < 0 || !Number.isSafeInteger(current.target) || current.target <= 0)
      return { key: definition.key, current: null, percent: null, remaining: null, state: "unavailable" };
    const percent = Math.min(100, Math.max(0, Math.round(current.progress / current.target * 100)));
    const remaining = Math.max(0, current.target - current.progress);
    const state = current.completed ? "completed" : remaining === 0 ? "pending" : "in_progress";
    return { key: definition.key, current, percent, remaining, state };
  });
}

export function nextChallenge(views: readonly ChallengeView[], kind: "daily" | "weekly"): ChallengeView | null {
  return views.filter((view) => challengeCatalog.find((entry) => entry.key === view.key)?.kind === kind && view.state === "in_progress")
    .sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0) || a.key.localeCompare(b.key))[0] ?? null;
}
